const Order    = require("../models/Order");
const Customer = require("../models/Customer");
const Counter  = require("../models/Counter");

const TOTAL_STEPS = 7; // Design&Wax, Casting, Filing, Stone, QC, FinalPolish, Packaging

// ── Helper: generate Bag ID ───────────────────────────────────────────────────
const generateBagId = async () => {
  const year = new Date().getFullYear();
  const key  = `bagId_${year}`;
  const seq  = await Counter.getNext(key);
  return `${year}${seq}`;
};

// ── Helper: get or create owner (Lariot Jweles) ───────────────────────────────
const getOwner = async () => {
  let owner = await Customer.findOne({ isOwner: true });
  if (!owner) {
    owner = await Customer.create({
      name:    "Lariot Jweles",
      company: "Lariot Jweles Mfg.",
      phone:   "0000000000",
      gold:    0,
      isOwner: true,
    });
    console.log("✦ Owner 'Lariot Jweles' auto-created");
  }
  return owner;
};

// ── GET /api/orders ───────────────────────────────────────────────────────────
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name phone gold diamonds company isOwner")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (err) { next(err); }
};

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name phone gold diamonds company isOwner");
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (err) { next(err); }
};

// ── POST /api/orders ──────────────────────────────────────────────────────────
// gramHistory starts EMPTY. First value is added at Casting step.
const createOrder = async (req, res, next) => {
  try {
    const {
      customerId, folder, item, itemNumber, itemWeight, itemImage,
      diamondShapes, labourCharge, size, notes, deliveryDate,
    } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

    // Detect if customer has no gold → will use owner's gold
    const owner         = await getOwner();
    const usesOwnerGold = (parseFloat(customer.gold) || 0) <= 0;

    const bagId  = await generateBagId();
    const weight = parseFloat(itemWeight) || 0;
    const labour = parseFloat(labourCharge) || 0;
    const lTotal = parseFloat((weight * labour).toFixed(2));
    const dDate  = deliveryDate
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
      status:        "In Progress",
      currentStep:   0,
      gramHistory:   [],          // ← EMPTY until Casting step
      designDone:    false,
      waxDone:       false,
      castingGold:   0,
      usesOwnerGold,
      ownerId:       usesOwnerGold ? owner._id : null,
    });

    const populated = await order.populate("customer", "name phone gold diamonds company isOwner");
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/step ────────────────────────────────────────────────
// Handles 3 different actions:
//   action = "substep"   → body: { subStep: "design"|"wax" }
//   action = "casting"   → body: { castingGrams: 12 }
//   action = "complete"  → body: { remainingGrams: 11.5 }  (steps 2-6)
const updateStep = async (req, res, next) => {
  try {
    const { action, subStep, castingGrams, remainingGrams } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order)                       return res.status(404).json({ success: false, error: "Order not found" });
    if (order.status === "Completed") return res.status(400).json({ success: false, error: "Order already completed" });

    // ── STEP 0: Design & Wax sub-steps ───────────────────────────────────────
    if (action === "substep") {
      if (order.currentStep !== 0)
        return res.status(400).json({ success: false, error: "Not at Design & Wax step" });
      if (!["design", "wax"].includes(subStep))
        return res.status(400).json({ success: false, error: "subStep must be 'design' or 'wax'" });

      if (subStep === "design") order.designDone = true;
      if (subStep === "wax")    order.waxDone    = true;

      // Both done → advance to Casting
      if (order.designDone && order.waxDone) {
        order.currentStep = 1;
      }

      await order.save();
      return res.status(200).json({ success: true, data: order });
    }

    // ── STEP 1: Casting — allocate gold to this bag ───────────────────────────
    if (action === "casting") {
      if (order.currentStep !== 1)
        return res.status(400).json({ success: false, error: "Not at Casting step" });

      const grams = parseFloat(castingGrams);
      if (!castingGrams || isNaN(grams) || grams <= 0)
        return res.status(400).json({ success: false, error: "Enter valid casting grams > 0" });

      // Deduct from customer or owner
      if (order.usesOwnerGold) {
        const owner = await Customer.findOne({ isOwner: true });
        if (!owner) return res.status(404).json({ success: false, error: "Owner not found" });
        if (owner.gold < grams)
          return res.status(400).json({ success: false, error: `Owner has only ${owner.gold}g. Cannot allocate ${grams}g.` });
        owner.gold = parseFloat((owner.gold - grams).toFixed(4));
        await owner.save();
      } else {
        const customer = await Customer.findById(order.customer);
        if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
        if (customer.gold < grams)
          return res.status(400).json({ success: false, error: `Customer has only ${customer.gold}g. Cannot allocate ${grams}g.` });
        customer.gold = parseFloat((customer.gold - grams).toFixed(4));
        await customer.save();
      }

      order.castingGold = grams;
      order.gramHistory = [grams]; // gramHistory starts HERE at Casting
      order.currentStep = 2;       // advance to Filing & Polishing

      await order.save();
      return res.status(200).json({ success: true, data: order });
    }

    // ── STEPS 2-6: Enter remaining gold (wastage tracking) ───────────────────
    if (action === "complete") {
      if (order.currentStep < 2)
        return res.status(400).json({ success: false, error: "Use 'substep' for Design&Wax or 'casting' for Casting" });

      const remaining = parseFloat(remainingGrams);
      if (remainingGrams === undefined || remainingGrams === "" || isNaN(remaining) || remaining < 0)
        return res.status(400).json({ success: false, error: "Enter valid remaining grams" });

      const prev = order.gramHistory[order.gramHistory.length - 1];
      if (remaining > prev)
        return res.status(400).json({ success: false, error: `Cannot exceed previous weight (${prev}g)` });

      order.gramHistory.push(remaining);
      order.currentStep += 1;
      if (order.currentStep >= TOTAL_STEPS) order.status = "Completed";

      await order.save();
      return res.status(200).json({ success: true, data: order });
    }

    // ── Backward compatibility: old orders without action field ──────────────
    // Old orders had gramHistory starting with customer.gold
    // They use remainingGrams directly without action field
    if (!action && remainingGrams !== undefined) {
      const remaining = parseFloat(remainingGrams);
      if (isNaN(remaining) || remaining < 0)
        return res.status(400).json({ success: false, error: "Invalid remaining grams" });

      const prev = order.gramHistory[order.gramHistory.length - 1];
      if (remaining > prev)
        return res.status(400).json({ success: false, error: `Cannot exceed previous (${prev}g)` });

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
      initialGold:  o.gramHistory[0] || 0,
      finalGold:    o.gramHistory[o.gramHistory.length - 1] || 0,
      wastage:      parseFloat(((o.gramHistory[0] || 0) - (o.gramHistory[o.gramHistory.length - 1] || 0)).toFixed(3)),
      completedAt:  o.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        orders:       report,
        totalWastage: parseFloat(report.reduce((s, r) => s + r.wastage, 0).toFixed(3)),
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

// ── GET /api/orders/owner ─────────────────────────────────────────────────────
// Returns the owner (Lariot Jweles), auto-creating if not exists
const getOwnerInfo = async (req, res, next) => {
  try {
    const owner = await getOwner();
    res.status(200).json({ success: true, data: owner });
  } catch (err) { next(err); }
};

module.exports = {
  getAllOrders, getOrderById, createOrder,
  updateStep, deleteOrder,
  getWastageReport, saveBillingData,
  getOwnerInfo,
};
