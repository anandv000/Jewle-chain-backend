const GoldEntry               = require("../models/GoldEntry");
const Customer                = require("../models/Customer");
const Counter                 = require("../models/Counter");
const { syncCustomerTotals }  = require("../services/customerService");
const { sendReceiptWhatsApp } = require("../services/whatsappService");

// ── Fiscal year ───────────────────────────────────────────────────────────────
const fiscalYear = () => {
  const now = new Date(); const yr = now.getFullYear(); const mo = now.getMonth() + 1;
  const s = mo >= 4 ? yr : yr - 1;
  return `${String(s).slice(2)}-${String(s + 1).slice(2)}`;
};

// GET /api/gold-entries/customer/:customerId
const getByCustomer = async (req, res, next) => {
  try {
    const entries = await GoldEntry.find({ customer: req.params.customerId }).sort({ date: -1 });
    res.status(200).json({ success: true, data: entries });
  } catch (err) { next(err); }
};

// GET /api/gold-entries/:id
const getById = async (req, res, next) => {
  try {
    const entry = await GoldEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found" });
    res.status(200).json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// POST /api/gold-entries
const createEntry = async (req, res, next) => {
  try {
    const {
      customerId,
      entryType = "gold_deposit",   // gold_deposit | silver_deposit | diamond_deposit | return
      partyVoucherNo, date, remark, sendWhatsapp,
      // gold_deposit / silver_deposit
      items,
      // diamond_deposit
      diamonds,
      // return
      returnGold, returnSilver, returnDiamonds,
    } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

    const fy = fiscalYear();
    const prefixMap = {
      gold_deposit:    "PRG",
      silver_deposit:  "SLV",  // ← NEW
      diamond_deposit: "DIA",
      return:          "RET",
    };
    const prefix    = prefixMap[entryType] || "PRG";
    const seq       = await Counter.getNext(`receipt_${prefix}_${fy}`);
    const receiptNo = `${prefix}/${fy}/${String(seq).padStart(4, "0")}`;

    const entryData = {
      receiptNo, entryType,
      customer:       customerId,
      customerName:   customer.name,
      customerPhone:  customer.phone,
      partyVoucherNo: partyVoucherNo || "",
      date:           date ? new Date(date) : new Date(),
      remark:         remark || "",
    };

    // ── Gold deposit ──────────────────────────────────────────────────────────
    if (entryType === "gold_deposit") {
      const rows        = (items || []).map((it, i) => ({ ...it, sr: i + 1 }));
      const totalWeight = parseFloat(rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0).toFixed(3));
      const totalPureWt = parseFloat(rows.reduce((s, r) => s + (parseFloat(r.pureWt)  || 0), 0).toFixed(3));
      entryData.items       = rows;
      entryData.totalWeight = totalWeight;
      entryData.totalPureWt = totalPureWt;
    }

    // ── Silver deposit (same structure as gold) ───────────────────────────────
    if (entryType === "silver_deposit") {
      const rows        = (items || []).map((it, i) => ({ ...it, sr: i + 1 }));
      const totalWeight = parseFloat(rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0).toFixed(3));
      const totalPureWt = parseFloat(rows.reduce((s, r) => s + (parseFloat(r.pureWt)  || 0), 0).toFixed(3));
      if (totalWeight <= 0) {
        return res.status(400).json({ success: false, error: "Silver weight must be greater than 0." });
      }
      entryData.items       = rows;
      entryData.totalWeight = totalWeight;
      entryData.totalPureWt = totalPureWt;
    }

    // ── Diamond deposit ───────────────────────────────────────────────────────
    if (entryType === "diamond_deposit") {
      const shapes = (diamonds || []).map(d => ({
        shapeId:   d.shapeId   || "",
        shapeName: d.shapeName || "",
        sizeInMM:  d.sizeInMM  || "",
        pcs:       parseInt(d.pcs)      || 0,
        karats:    parseFloat(d.karats) || 0,
      }));
      const totalDiamondPcs    = shapes.reduce((s, d) => s + d.pcs, 0);
      const totalDiamondKarats = parseFloat(shapes.reduce((s, d) => s + d.karats, 0).toFixed(4));
      if (totalDiamondKarats <= 0) {
        return res.status(400).json({ success: false, error: "Total diamond karats must be greater than 0." });
      }
      entryData.diamonds           = shapes;
      entryData.totalDiamondPcs    = totalDiamondPcs;
      entryData.totalDiamondKarats = totalDiamondKarats;
    }

    // ── Return ────────────────────────────────────────────────────────────────
    if (entryType === "return") {
      const retDia = (returnDiamonds || []).map(d => ({
        shapeId:   d.shapeId   || "",
        shapeName: d.shapeName || "",
        sizeInMM:  d.sizeInMM  || "",
        pcs:       parseInt(d.pcs)      || 0,
        karats:    parseFloat(d.karats) || 0,
      }));
      const returnDiamondKarats = parseFloat(retDia.reduce((s, d) => s + d.karats, 0).toFixed(4));
      const rGold   = parseFloat(returnGold)   || 0;
      const rSilver = parseFloat(returnSilver) || 0;
      if (rGold <= 0 && rSilver <= 0 && retDia.length === 0) {
        return res.status(400).json({ success: false, error: "Return must include gold, silver, or diamonds." });
      }
      entryData.returnGold          = rGold;
      entryData.returnSilver        = rSilver;   // ← NEW
      entryData.returnDiamonds      = retDia;
      entryData.returnDiamondKarats = returnDiamondKarats;
    }

    const entry = await GoldEntry.create(entryData);

    // ── Sync customer totals (bug fix: accounts for returns + castings) ───────
    const newTotals = await syncCustomerTotals(customerId);

    // ── WhatsApp (gold_deposit only, optional) ────────────────────────────────
    let whatsappResult = { sent: false };
    if (sendWhatsapp && entryType === "gold_deposit") {
      try {
        whatsappResult = await sendReceiptWhatsApp(entry);
        if (whatsappResult.sent) { entry.whatsappSent = true; await entry.save(); }
      } catch (e) { whatsappResult = { sent: false, reason: e.message }; }
    }

    res.status(201).json({ success: true, data: entry.toObject(), whatsapp: whatsappResult, newTotals });
  } catch (err) { next(err); }
};

const downloadPdf = async (req, res, next) => {
  try {
    const entry = await GoldEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found" });
    res.status(200).json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// DELETE /api/gold-entries/:id
const deleteEntry = async (req, res, next) => {
  try {
    const entry = await GoldEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found" });
    await syncCustomerTotals(entry.customer);
    res.status(200).json({ success: true, message: "Entry deleted" });
  } catch (err) { next(err); }
};

module.exports = { getByCustomer, getById, createEntry, downloadPdf, deleteEntry };
