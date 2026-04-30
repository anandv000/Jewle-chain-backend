const path                    = require("path");
const fs                      = require("fs");
const Customer                = require("../models/Customer");
const GoldEntry               = require("../models/GoldEntry");
const Counter                 = require("../models/Counter");
const { generateReceipt }     = require("../services/receiptService");
const { sendReceiptWhatsApp } = require("../services/whatsappService");

// ── Fiscal year string ────────────────────────────────────────────────────────
const fiscalYear = () => {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth() + 1;
  const s   = mo >= 4 ? yr : yr - 1;
  return `${String(s).slice(2)}-${String(s + 1).slice(2)}`; // "25-26"
};

// ── Auto-create first gold entry + PDF ────────────────────────────────────────
const createInitialGoldEntry = async (customer) => {
  try {
    const fy        = fiscalYear();
    const seq       = await Counter.getNext(`receiptPRG_${fy}`);
    const receiptNo = `PRG/${fy}/${String(seq).padStart(4, "0")}`;
    const weight    = parseFloat(customer.gold) || 0;

    const entry = await GoldEntry.create({
      receiptNo,
      customer:      customer._id,
      customerName:  customer.name,
      customerPhone: customer.phone,
      partyVoucherNo: "",
      date:  new Date(),
      items: [{
        sr:          1,
        item:        "Initial Gold",
        quality:     customer.goldCarats ? `${customer.goldCarats} Carat` : "",
        weight,
        pureWt:      weight,
        pieces:      0,
        shape: "", accessories: "", size: "", description: "Opening gold balance",
      }],
      remark:      "Initial gold entry on customer registration",
      totalWeight: weight,
      totalPureWt: weight,
    });

    // Generate PDF
    const uploadsDir = process.env.NODE_ENV === 'production'
      ? path.join('/tmp', 'uploads/receipts')
      : path.join(__dirname, "../uploads/receipts");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const pdfPath  = path.join(uploadsDir, `${receiptNo.replace(/\//g, "-")}.pdf`);
    const logoPath = process.env.LOGO_PATH || path.join(__dirname, "../../logo.png");
    try {
      await generateReceipt(entry, pdfPath, logoPath);
      entry.pdfPath = pdfPath;
      await entry.save();
    } catch (e) { console.warn("PDF gen failed:", e.message); }

    // ── Send WhatsApp receipt to customer on first entry ──────────────────────
    try {
      const waResult = await sendReceiptWhatsApp(entry);
      if (waResult.sent) {
        entry.whatsappSent = true;
        await entry.save();
        console.log(`✅ Initial WhatsApp sent to ${customer.phone}`);
      }
    } catch (e) { console.warn("Initial WhatsApp failed:", e.message); }

    return entry;
  } catch (err) {
    console.warn("Auto gold entry failed:", err.message);
    return null;
  }
};

// ── GET /api/customers ────────────────────────────────────────────────────────
const getAllCustomers = async (req, res, next) => {
  try {
    const list = await Customer.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (err) { next(err); }
};

const getCustomerById = async (req, res, next) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, error: "Customer not found" });
    res.status(200).json({ success: true, data: c });
  } catch (err) { next(err); }
};

// ── POST /api/customers ───────────────────────────────────────────────────────
const createCustomer = async (req, res, next) => {
  try {
    const { name, company, phone, gold, goldCarats, silver, diamonds, diamondKarats, labourRateGold, labourRateSilver } = req.body;
    const customer = await Customer.create({
      name, company, phone,
      gold:             parseFloat(gold)             || 0,
      goldCarats:       parseFloat(goldCarats)        || 0,
      silver:           parseFloat(silver)            || 0,
      diamonds:         parseInt(diamonds)            || 0,
      diamondKarats:    parseFloat(diamondKarats)     || 0,
      labourRateGold:   parseFloat(labourRateGold)    || 0,
      labourRateSilver: parseFloat(labourRateSilver)  || 0,
    });

    // Auto first entry + PDF when gold > 0
    let firstEntry = null;
    if (parseFloat(gold) > 0) firstEntry = await createInitialGoldEntry(customer);

    res.status(201).json({ success: true, data: customer, firstEntry: firstEntry?.toObject() || null });
  } catch (err) { next(err); }
};

// ── PUT /api/customers/:id ────────────────────────────────────────────────────
const updateCustomer = async (req, res, next) => {
  try {
    const { name, company, phone, gold, goldCarats, silver, diamonds, diamondKarats, labourRateGold, labourRateSilver } = req.body;
    const c = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        name, company, phone,
        gold:             parseFloat(gold)             || 0,
        goldCarats:       parseFloat(goldCarats)        || 0,
        silver:           parseFloat(silver)            || 0,
        diamonds:         parseInt(diamonds)            || 0,
        diamondKarats:    parseFloat(diamondKarats)     || 0,
        labourRateGold:   parseFloat(labourRateGold)    || 0,
        labourRateSilver: parseFloat(labourRateSilver)  || 0,
      },
      { new: true, runValidators: true }
    );
    if (!c) return res.status(404).json({ success: false, error: "Customer not found" });
    res.status(200).json({ success: true, data: c });
  } catch (err) { next(err); }
};

// ── DELETE /api/customers/:id ─────────────────────────────────────────────────
const deleteCustomer = async (req, res, next) => {
  try {
    const c = await Customer.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ success: false, error: "Customer not found" });
    res.status(200).json({ success: true, message: "Customer deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };
