const Order    = require("../models/Order");
const Customer = require("../models/Customer");
const Counter  = require("../models/Counter");
const { syncCustomerTotals } = require("../services/customerService");

const TOTAL_STEPS = 7;

// ── Generate Bag ID ───────────────────────────────────────────────────────────
const generateBagId = async () => {
  const year = new Date().getFullYear();
  const key  = `bagId_${year}`;
  const seq  = await Counter.getNext(key);
  return `${year}${seq}`;
};

// ── Get or create owner (Lariot Jweles) ───────────────────────────────────────
const getOwner = async () => {
  let owner = await Customer.findOne({ isOwner: true });
  if (!owner) {
    owner = await Customer.create({
      name: "Lariot Jweles", company: "Lariot Jweles Mfg.",
      phone: "0000000000", gold: 0, silver: 0, isOwner: true,
    });
    console.log("✦ Owner 'Lariot Jweles' auto-created");
  }
  return owner;
};

// ── GET /api/orders ───────────────────────────────────────────────────────────
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name phone gold silver diamonds company isOwner")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (err) { next(err); }
};

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name phone gold silver diamonds company isOwner");
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ── POST /api/orders ──────────────────────────────────────────────────────────
// gramHistory starts EMPTY — first value added at Casting step.
const createOrder = async (req, res, next) => {
  try {
    const {
      customerId, folder, item, itemNumber, itemWeight, itemImage,
      diamondShapes, size, notes, deliveryDate,
      metalType = "gold",  // ← NEW: "gold" or "silver"
    } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

    const owner = await getOwner();

    // Determine if owner's metal is needed
    const usesOwnerGold   = metalType === "gold"   && (parseFloat(customer.gold)   || 0) <= 0;
    const usesOwnerSilver = metalType === "silver"  && (parseFloat(customer.silver) || 0) <= 0;

    const bagId  = await generateBagId();
    const weight = parseFloat(itemWeight) || 0;
    // Auto-calculate labour from customer stored rate
    const labour = metalType === "silver"
      ? (parseFloat(customer.labourRateSilver) || 0)
      : (parseFloat(customer.labourRateGold)   || 0);
    const lTotal = parseFloat((weight * labour).toFixed(2));
    const dDate  = deliveryDate
      ? new Date(deliveryDate)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const order = await Order.create({
      bagId,
      customer:      customerId,
      customerName:  customer.name,
      folder, item,
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
      status:        "In Progress",
      currentStep:   0,
      gramHistory:   [],
      designDone:    false,
      waxDone:       false,
      metalType,
      castingGold:    0,
      castingSilver:  0,
      usesOwnerGold,
      usesOwnerSilver,
      ownerId:        (usesOwnerGold || usesOwnerSilver) ? owner._id : null,
    });

    const populated = await order.populate("customer", "name phone gold silver diamonds company isOwner");
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/step ────────────────────────────────────────────────
const updateStep = async (req, res, next) => {
  try {
    const { action, subStep, castingGrams, remainingGrams } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order)                       return res.status(404).json({ success: false, error: "Order not found" });
    if (order.status === "Completed") return res.status(400).json({ success: false, error: "Order already completed" });

    // ── STEP 0: Design & Wax sub-steps ───────────────────────────────────────
    if (action === "substep") {
      if (order.currentStep !== 0) return res.status(400).json({ success: false, error: "Not at Design & Wax step" });
      if (!["design","wax"].includes(subStep)) return res.status(400).json({ success: false, error: "subStep must be 'design' or 'wax'" });
      if (subStep === "design") order.designDone = true;
      if (subStep === "wax")    order.waxDone    = true;
      if (order.designDone && order.waxDone) order.currentStep = 1;
      await order.save();
      return res.status(200).json({ success: true, data: order });
    }

    // ── STEP 1: Casting ───────────────────────────────────────────────────────
    if (action === "casting") {
      if (order.currentStep !== 1) return res.status(400).json({ success: false, error: "Not at Casting step" });
      const grams = parseFloat(castingGrams);
      if (!castingGrams || isNaN(grams) || grams <= 0) return res.status(400).json({ success: false, error: "Enter valid casting grams > 0" });

      const isGold   = order.metalType === "gold"   || !order.metalType;
      const isSilver = order.metalType === "silver";

      if (isGold) {
        // Check available balance (owner or customer)
        if (order.usesOwnerGold) {
          const owner = await Customer.findOne({ isOwner: true });
          if (!owner) return res.status(404).json({ success: false, error: "Owner not found" });
          if ((owner.gold || 0) < grams) return res.status(400).json({ success: false, error: `Owner has only ${owner.gold}g gold. Cannot allocate ${grams}g.` });
        } else {
          const customer = await Customer.findById(order.customer);
          if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
          // Check: available = deposited - returned - already cast in other orders
          // We just use the synced customer.gold which is already correct
          if ((customer.gold || 0) < grams) return res.status(400).json({ success: false, error: `Customer has only ${customer.gold}g gold. Cannot allocate ${grams}g.` });
        }
        order.castingGold = grams;
      }

      if (isSilver) {
        if (order.usesOwnerSilver) {
          const owner = await Customer.findOne({ isOwner: true });
          if (!owner) return res.status(404).json({ success: false, error: "Owner not found" });
          if ((owner.silver || 0) < grams) return res.status(400).json({ success: false, error: `Owner has only ${owner.silver}g silver. Cannot allocate ${grams}g.` });
        } else {
          const customer = await Customer.findById(order.customer);
          if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
          if ((customer.silver || 0) < grams) return res.status(400).json({ success: false, error: `Customer has only ${customer.silver}g silver. Cannot allocate ${grams}g.` });
        }
        order.castingSilver = grams;
      }

      order.gramHistory = [grams];  // gramHistory[0] = casting grams
      order.currentStep = 2;        // advance to Filing & Polishing
      await order.save();

      // ── Sync BOTH the customer AND the owner after saving the order ──────────
      // syncCustomerTotals will subtract this casting from the correct balance
      const targetId = order.usesOwnerGold || order.usesOwnerSilver
        ? (await Customer.findOne({ isOwner: true }))?._id
        : order.customer;
      if (targetId) await syncCustomerTotals(targetId);
      // Also sync the customer (if owner was used, still sync the customer)
      if (order.usesOwnerGold || order.usesOwnerSilver) await syncCustomerTotals(order.customer);

      return res.status(200).json({ success: true, data: order });
    }

    // ── STEPS 2–6: Enter remaining grams ──────────────────────────────────────
    if (action === "complete") {
      if (order.currentStep < 2) return res.status(400).json({ success: false, error: "Use 'substep' for Design&Wax or 'casting' for Casting" });
      const remaining = parseFloat(remainingGrams);
      if (remainingGrams === undefined || isNaN(remaining) || remaining < 0) return res.status(400).json({ success: false, error: "Enter valid remaining grams" });
      const prev = order.gramHistory[order.gramHistory.length - 1];
      if (remaining > prev) return res.status(400).json({ success: false, error: `Cannot exceed previous weight (${prev}g)` });
      order.gramHistory.push(remaining);
      order.currentStep += 1;
      if (order.currentStep >= TOTAL_STEPS) order.status = "Completed";
      await order.save();
      return res.status(200).json({ success: true, data: order });
    }

    // ── Backward compatibility (old orders without action) ────────────────────
    if (!action && remainingGrams !== undefined) {
      const remaining = parseFloat(remainingGrams);
      if (isNaN(remaining) || remaining < 0) return res.status(400).json({ success: false, error: "Invalid remaining grams" });
      const prev = order.gramHistory[order.gramHistory.length - 1];
      if (remaining > prev) return res.status(400).json({ success: false, error: `Cannot exceed previous (${prev}g)` });
      order.gramHistory.push(remaining);
      order.currentStep += 1;
      if (order.currentStep >= TOTAL_STEPS) order.status = "Completed";
      await order.save();
      return res.status(200).json({ success: true, data: order });
    }

    return res.status(400).json({ success: false, error: "Invalid action. Use 'substep', 'casting', or 'complete'" });
  } catch (err) { next(err); }
};

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    // Re-sync customer after order deleted (restores gold used in casting)
    await syncCustomerTotals(order.customer);
    if (order.usesOwnerGold || order.usesOwnerSilver) {
      const owner = await Customer.findOne({ isOwner: true });
      if (owner) await syncCustomerTotals(owner._id);
    }
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
      metalType:    o.metalType || "gold",
      initialGold:  o.gramHistory[0] || 0,
      finalGold:    o.gramHistory[o.gramHistory.length - 1] || 0,
      wastage:      parseFloat(((o.gramHistory[0] || 0) - (o.gramHistory[o.gramHistory.length - 1] || 0)).toFixed(3)),
      completedAt:  o.updatedAt,
    }));
    res.status(200).json({ success: true, data: { orders: report, totalWastage: parseFloat(report.reduce((s, r) => s + r.wastage, 0).toFixed(3)), totalOrders: report.length } });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/billing ─────────────────────────────────────────────
const saveBillingData = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    order.billingData = { ...req.body, savedAt: new Date() };
    await order.save();
    res.status(200).json({ success: true, data: order.billingData });
  } catch (err) { next(err); }
};

// ── GET /api/orders/owner ─────────────────────────────────────────────────────
const getOwnerInfo = async (req, res, next) => {
  try {
    const owner = await getOwner();
    res.status(200).json({ success: true, data: owner });
  } catch (err) { next(err); }
};

module.exports = { getAllOrders, getOrderById, createOrder, updateStep, deleteOrder, getWastageReport, saveBillingData, getOwnerInfo };
