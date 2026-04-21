const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");
const Order   = require("../models/Order");

// ── Invoice number format: JB/YY_YY-NNNN ─────────────────────────────────────
const generateInvoiceNo = async () => {
  const now   = new Date();
  const yr1   = now.getFullYear().toString().slice(2);                  // "25"
  const yr2   = (now.getFullYear() + 1).toString().slice(2);           // "26"
  const key   = `invoice_${yr1}_${yr2}`;
  const seq   = await Counter.getNext(key);
  return `JB/${yr1}_${yr2}-${seq}`;
};

// ── Compute all totals from items ─────────────────────────────────────────────
const computeSummary = (items, otherCharges) => {
  let totalGrossWt = 0, totalNetWt = 0, totalFineWt = 0;
  let totalDiamondPcs = 0, totalDiamondWt = 0;
  let totalStonePcs = 0, totalStoneWt = 0;
  let totalMetalAmt = 0, totalLabourAmt = 0;
  let totalDiamondAmt = 0, totalStoneAmt = 0, totalOtherAmt = 0;

  for (const it of items) {
    totalGrossWt    += it.grossWt    || 0;
    totalNetWt      += it.netWt      || 0;
    totalFineWt     += it.fineWt     || 0;
    totalMetalAmt   += it.metalAmt   || 0;
    totalLabourAmt  += it.labourAmt  || 0;
    totalOtherAmt   += it.otherAmt   || 0;

    for (const d of (it.diamonds || [])) {
      totalDiamondPcs += d.pcs || 0;
      totalDiamondWt  += d.wt  || 0;
      totalDiamondAmt += d.amt || 0;
    }
    for (const s of (it.stones || [])) {
      totalStonePcs += s.pcs || 0;
      totalStoneWt  += s.wt  || 0;
      totalStoneAmt += s.amt || 0;
    }
  }

  const extraCharges =
    (otherCharges?.hallMarking || 0) +
    (otherCharges?.certy       || 0) +
    (otherCharges?.shipping    || 0) +
    (otherCharges?.addLess     || 0);

  const making     = totalLabourAmt;
  const grandTotal = totalMetalAmt + totalLabourAmt + totalDiamondAmt +
                     totalStoneAmt + totalOtherAmt + extraCharges;

  return {
    totalGrossWt:    parseFloat(totalGrossWt.toFixed(3)),
    totalNetWt:      parseFloat(totalNetWt.toFixed(3)),
    totalFineWt:     parseFloat(totalFineWt.toFixed(3)),
    totalDiamondPcs, totalDiamondWt: parseFloat(totalDiamondWt.toFixed(4)),
    totalStonePcs,   totalStoneWt:   parseFloat(totalStoneWt.toFixed(4)),
    totalMetalAmt:   parseFloat(totalMetalAmt.toFixed(2)),
    totalLabourAmt:  parseFloat(totalLabourAmt.toFixed(2)),
    totalDiamondAmt: parseFloat(totalDiamondAmt.toFixed(2)),
    totalStoneAmt:   parseFloat(totalStoneAmt.toFixed(2)),
    totalOtherAmt:   parseFloat(totalOtherAmt.toFixed(2)),
    making:          parseFloat(making.toFixed(2)),
    grandTotal:      parseFloat(grandTotal.toFixed(2)),
  };
};

// ── Compute fine weight from order data ───────────────────────────────────────
const karatToPercent = (karat) => {
  const map = {
    "24": 99.9, "22": 91.6, "20": 83.3, "18": 75.0,
    "14": 58.3, "10": 41.7, "9": 37.5,
    "S999": 99.9, "S925": 92.5, "S800": 80.0,
  };
  return map[String(karat)] || 0;
};

// ── Enrich item with fine wt + lineTotal ──────────────────────────────────────
const enrichItem = (item) => {
  // ── Sanitize: empty string orderId must be null — MongoDB can't cast "" to ObjectId
  const orderId = (item.orderId && item.orderId !== "") ? item.orderId : null;

  const fp     = item.finePercent || karatToPercent(item.karat) || 0;
  const fineWt = parseFloat(((item.netWt || 0) * fp / 100).toFixed(3));

  const diamondAmt = (item.diamonds || []).reduce((s, d) => s + (d.amt || 0), 0);
  const stoneAmt   = (item.stones   || []).reduce((s, s2) => s + (s2.amt || 0), 0);
  const lineTotal  = (item.metalAmt || 0) + (item.labourAmt || 0) +
                     diamondAmt + stoneAmt + (item.otherAmt || 0);

  return {
    ...item,
    orderId,                              // null-safe
    finePercent: fp,
    fineWt,
    lineTotal: parseFloat(lineTotal.toFixed(2)),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/invoices
// ─────────────────────────────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const invoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .populate("customer", "name company phone");
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/invoices/:id
// ─────────────────────────────────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer", "name company phone");
    if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found" });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/invoices/preview-from-orders — build draft from selected order IDs
// ─────────────────────────────────────────────────────────────────────────────
const previewFromOrders = async (req, res, next) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds?.length)
      return res.status(400).json({ success: false, error: "No order IDs provided" });

    const orders = await Order.find({ _id: { $in: orderIds } });

    const items = orders.map(o => {
      const grossWt   = o.castingGold || o.castingSilver || 0;
      const netWt     = o.gramHistory?.length
        ? o.gramHistory[o.gramHistory.length - 1]
        : grossWt;
      const karat     = o.metalType === "silver" ? "S925" : "18";
      const fp        = karatToPercent(karat);
      const fineWt    = parseFloat((netWt * fp / 100).toFixed(3));
      const diamonds  = (o.diamondShapes || []).map(d => ({
        shape: d.shapeName || "",
        size:  d.sizeInMM  || "",
        pcs:   d.pcs       || 1,
        wt:    d.weight    || 0,
        rate:  0,
        amt:   0,
      }));

      return {
        orderId:    o._id,
        bagId:      o.bagId      || "",
        design:     o.itemNumber || o.item || "",
        category:   o.folder     || "",
        qty:        1,
        karat,
        finePercent: fp,
        grossWt,
        netWt,
        fineWt,
        metalRate:  0,
        metalAmt:   0,
        labourRate: 0,
        labourAmt:  o.labourTotal || 0,
        diamonds,
        stones:     [],
        otherDescr: "",
        otherAmt:   0,
        lineTotal:  o.labourTotal || 0,
      };
    });

    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/invoices — create
// ─────────────────────────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const {
      invoiceType, date, customer, customerName,
      items = [], remarks, otherCharges,
      creditAmount, debitAmount, metalBalance, cdmdWt,
      status,
    } = req.body;

    if (!customer) return res.status(400).json({ success: false, error: "Customer is required" });
    if (!items.length) return res.status(400).json({ success: false, error: "At least one item is required" });

    const invoiceNo  = await generateInvoiceNo();
    const enriched   = items.map(enrichItem);
    const summary    = computeSummary(enriched, otherCharges);

    const invoice = await Invoice.create({
      invoiceNo,
      invoiceType: invoiceType || "estimate",
      date:        date || new Date(),
      customer,
      customerName: customerName || "",
      items:        enriched,
      remarks:      remarks || "",
      otherCharges: otherCharges || {},
      ...summary,
      creditAmount: creditAmount || 0,
      debitAmount:  debitAmount  || 0,
      metalBalance: metalBalance || 0,
      cdmdWt:       cdmdWt       || 0,
      status:       status       || "draft",
      createdBy:    req.user?._id || null,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/invoices/:id — update
// ─────────────────────────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found" });

    const {
      invoiceType, date, customer, customerName,
      items, remarks, otherCharges,
      creditAmount, debitAmount, metalBalance, cdmdWt,
      status,
    } = req.body;

    if (invoiceType)    invoice.invoiceType    = invoiceType;
    if (date)           invoice.date           = date;
    if (customer)       invoice.customer       = customer;
    if (customerName)   invoice.customerName   = customerName;
    if (remarks !== undefined) invoice.remarks = remarks;
    if (status)         invoice.status         = status;
    if (creditAmount !== undefined) invoice.creditAmount = creditAmount;
    if (debitAmount  !== undefined) invoice.debitAmount  = debitAmount;
    if (metalBalance !== undefined) invoice.metalBalance = metalBalance;
    if (cdmdWt       !== undefined) invoice.cdmdWt       = cdmdWt;

    if (items) {
      const enriched      = items.map(enrichItem);
      const summary       = computeSummary(enriched, otherCharges || invoice.otherCharges);
      invoice.items       = enriched;
      invoice.otherCharges = otherCharges || invoice.otherCharges;
      Object.assign(invoice, summary);
    } else if (otherCharges) {
      invoice.otherCharges = otherCharges;
      const summary = computeSummary(invoice.items, otherCharges);
      Object.assign(invoice, summary);
    }

    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/invoices/:id
// ─────────────────────────────────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found" });
    res.json({ success: true, message: "Invoice deleted" });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/invoices/:id/status
// ─────────────────────────────────────────────────────────────────────────────
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found" });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove, updateStatus, previewFromOrders };
