const Order    = require("../models/Order");
const Customer = require("../models/Customer");
const Counter  = require("../models/Counter");

const TOTAL_STEPS = 7;

// ── Helper: generate Bag ID ───────────────────────────────────────────────────
const generateBagId = async () => {
  const year = new Date().getFullYear();
  const key  = `bagId_${year}`;
  const seq  = await Counter.getNext(key);
  return `${year}${seq}`; // e.g. 202601, 202602 …
};

// ── GET /api/orders ───────────────────────────────────────────────────────────
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name phone gold diamonds company")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (err) { next(err); }
};

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name phone gold diamonds company");
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ── POST /api/orders ──────────────────────────────────────────────────────────
const createOrder = async (req, res, next) => {
  try {
    const {
      customerId, folder, item, itemNumber, itemWeight, itemImage,
      diamondShapes, labourCharge, size, notes, deliveryDate,
    } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

    // Auto bag ID
    const bagId = await generateBagId();

    // Labour total
    const weight  = parseFloat(itemWeight) || 0;
    const labour  = parseFloat(labourCharge) || 0;
    const lTotal  = parseFloat((weight * labour).toFixed(2));

    // Delivery date: provided or today + 7 days
    const dDate = deliveryDate
      ? new Date(deliveryDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const order = await Order.create({
      bagId,
      customer:      customerId,
      customerName:  customer.name,
      folder,
      item,
      itemNumber:    itemNumber || "",
      itemWeight:    weight,
      itemImage:     itemImage || null,
      diamondShapes: diamondShapes || [],
      labourCharge:  labour,
      labourTotal:   lTotal,
      size:          size  || "",
      notes:         notes || "",
      orderDate:     new Date(),
      deliveryDate:  dDate,
      status:       "In Progress",
      currentStep:   0,
      gramHistory:  [parseFloat(customer.gold) || 0],
    });

    const populated = await order.populate("customer", "name phone gold diamonds company");
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/step ────────────────────────────────────────────────
const updateStep = async (req, res, next) => {
  try {
    const { remainingGrams } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order)                    return res.status(404).json({ success: false, error: "Order not found" });
    if (order.status === "Completed") return res.status(400).json({ success: false, error: "Order already completed" });

    const remaining = parseFloat(remainingGrams);
    if (isNaN(remaining) || remaining < 0) return res.status(400).json({ success: false, error: "Invalid remaining grams" });

    const prev = order.gramHistory[order.gramHistory.length - 1];
    if (remaining > prev) return res.status(400).json({ success: false, error: `Cannot exceed previous (${prev}g)` });

    order.gramHistory.push(remaining);
    order.currentStep += 1;
    if (order.currentStep >= TOTAL_STEPS) order.status = "Completed";

    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.status(200).json({ success: true, message: "Order deleted" });
  } catch (err) { next(err); }
};

// ── GET /api/orders/wastage ───────────────────────────────────────────────────
const getWastageReport = async (req, res, next) => {
  try {
    const completed = await Order.find({ status: "Completed" })
      .populate("customer", "name company")
      .sort({ updatedAt: -1 });

    const report = completed.map(o => ({
      _id:          o._id,
      bagId:        o.bagId,
      customerName: o.customerName,
      product:      `${o.folder} - ${o.item}`,
      initialGold:  o.gramHistory[0],
      finalGold:    o.gramHistory[o.gramHistory.length - 1],
      wastage:      parseFloat((o.gramHistory[0] - o.gramHistory[o.gramHistory.length - 1]).toFixed(2)),
      completedAt:  o.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        orders:       report,
        totalWastage: parseFloat(report.reduce((s, r) => s + r.wastage, 0).toFixed(2)),
        totalOrders:  report.length,
      },
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/billing ────────────────────────────────────────────
const saveBillingData = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.billingData = { ...req.body, savedAt: new Date() };
    await order.save();

    res.status(200).json({ success: true, data: order.billingData });
  } catch (err) { next(err); }
};

module.exports = { getAllOrders, getOrderById, createOrder, updateStep, deleteOrder, getWastageReport, saveBillingData };
