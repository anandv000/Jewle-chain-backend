const GoldEntry               = require("../models/GoldEntry");
const Customer                = require("../models/Customer");
const Counter                 = require("../models/Counter");
const { sendReceiptWhatsApp } = require("../services/whatsappService");

// ── Fiscal year ───────────────────────────────────────────────────────────────
const fiscalYear = () => {
  const now = new Date(); const yr = now.getFullYear(); const mo = now.getMonth() + 1;
  const s = mo >= 4 ? yr : yr - 1;
  return `${String(s).slice(2)}-${String(s + 1).slice(2)}`;
};

// ── Recalculate customer's total gold from all entries ────────────────────────
const syncCustomerGold = async (customerId) => {
  try {
    const entries = await GoldEntry.find({ customer: customerId });
    const total   = parseFloat(entries.reduce((s, e) => s + (e.totalWeight || 0), 0).toFixed(3));
    await Customer.findByIdAndUpdate(customerId, { gold: total });
    return total;
  } catch (err) {
    console.warn("syncCustomerGold failed:", err.message);
    return null;
  }
};

// ── GET /api/gold-entries/customer/:customerId ────────────────────────────────
const getByCustomer = async (req, res, next) => {
  try {
    const entries = await GoldEntry.find({ customer: req.params.customerId }).sort({ date: -1 });
    res.status(200).json({ success: true, data: entries });
  } catch (err) { next(err); }
};

// ── GET /api/gold-entries/:id ─────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const entry = await GoldEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found" });
    res.status(200).json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// ── POST /api/gold-entries ────────────────────────────────────────────────────
const createEntry = async (req, res, next) => {
  try {
    const { customerId, partyVoucherNo, date, items, remark, sendWhatsapp } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

    // Receipt number
    const fy        = fiscalYear();
    const seq       = await Counter.getNext(`receiptPRG_${fy}`);
    const receiptNo = `PRG/${fy}/${String(seq).padStart(4, "0")}`;

    // Totals
    const rows        = (items || []).map((it, i) => ({ ...it, sr: i + 1 }));
    const totalWeight = parseFloat(rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0).toFixed(3));
    const totalPureWt = parseFloat(rows.reduce((s, r) => s + (parseFloat(r.pureWt)  || 0), 0).toFixed(3));

    // Save entry — NO PDF generation (Vercel = read-only filesystem)
    // Receipt is generated client-side in the browser (same as BagWorkflow PDF)
    const entry = await GoldEntry.create({
      receiptNo,
      customer:       customerId,
      customerName:   customer.name,
      customerPhone:  customer.phone,
      partyVoucherNo: partyVoucherNo || "",
      date:           date ? new Date(date) : new Date(),
      items:          rows,
      remark:         remark || "",
      totalWeight,
      totalPureWt,
    });

    // Sync customer gold total
    const newGoldTotal = await syncCustomerGold(customerId);

    // WhatsApp (optional — only if configured)
    let whatsappResult = { sent: false };
    if (sendWhatsapp) {
      try {
        whatsappResult = await sendReceiptWhatsApp(entry);
        if (whatsappResult.sent) {
          entry.whatsappSent = true;
          await entry.save();
        }
      } catch (waErr) {
        console.warn("WhatsApp send failed:", waErr.message);
        whatsappResult = { sent: false, reason: waErr.message };
      }
    }

    res.status(201).json({
      success:      true,
      data:         entry.toObject(),
      whatsapp:     whatsappResult,
      newGoldTotal, // frontend updates customer card instantly
    });
  } catch (err) { next(err); }
};

// ── GET /api/gold-entries/:id/pdf ─────────────────────────────────────────────
// PDF is now generated client-side — this endpoint returns the entry data only
// Kept for backward compatibility but no longer streams a file
const downloadPdf = async (req, res, next) => {
  try {
    const entry = await GoldEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found" });
    // Return entry data so client can build the receipt
    res.status(200).json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// ── DELETE /api/gold-entries/:id ──────────────────────────────────────────────
const deleteEntry = async (req, res, next) => {
  try {
    const entry = await GoldEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found" });
    // No file cleanup needed — no PDFs stored on disk
    await syncCustomerGold(entry.customer);
    res.status(200).json({ success: true, message: "Entry deleted" });
  } catch (err) { next(err); }
};

module.exports = { getByCustomer, getById, createEntry, downloadPdf, deleteEntry };
