const mongoose = require("mongoose");

const STEPS = [
  "Design & Wax", "Casting", "Filing & Polishing",
  "Stone Setting", "Quality Check", "Final Polish", "Packaging"
];

const diamondSelectionSchema = new mongoose.Schema({
  shapeId:   String,
  shapeName: String,
  sizeInMM:  String,
  weight:    Number,
  pcs:       { type: Number, default: 1 },
}, { _id: false });

const accessorySchema = new mongoose.Schema({
  name:   String,
  issue1: { type: String, default: "" }, issue2: { type: String, default: "" }, issue3: { type: String, default: "" },
  rec1:   { type: String, default: "" }, rec2:   { type: String, default: "" }, rec3:   { type: String, default: "" },
}, { _id: false });

const deptSchema = new mongoose.Schema({
  dept: String, date: { type: String, default: "" }, worker: { type: String, default: "" },
  issue: { type: String, default: "" }, rec: { type: String, default: "" },
  diff: { type: String, default: "" }, dust: { type: String, default: "" },
}, { _id: false });

const billingDataSchema = new mongoose.Schema({
  cCode: { type: String, default: "" }, kt: { type: String, default: "" },
  bagQty: { type: String, default: "1" }, styleInstr: { type: String, default: "" },
  findingInstr: { type: String, default: "" },
  accessories: { type: [accessorySchema], default: [] },
  depts:        { type: [deptSchema],     default: [] },
  savedAt: { type: Date, default: null },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    bagId:       { type: String, unique: true },
    customer:     { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, trim: true },

    folder:     { type: String, required: true },
    item:       { type: String, required: true },
    itemNumber: { type: String, default: "" },
    itemWeight: { type: Number, default: 0 },
    itemImage:  { type: String, default: null },

    diamondShapes: { type: [diamondSelectionSchema], default: [] },
    labourCharge:  { type: Number, default: 0 },
    labourTotal:   { type: Number, default: 0 },

    orderDate:    { type: Date, default: Date.now },
    deliveryDate: { type: Date, default: null },
    size:         { type: String, default: "" },
    notes:        { type: String, default: "" },

    // ── Workflow ───────────────────────────────────────────────────────────────
    status:      { type: String, enum: ["In Progress", "Completed"], default: "In Progress" },
    currentStep: { type: Number, default: 0, min: 0, max: STEPS.length },

    // gramHistory starts EMPTY — first value added at Casting step
    // gramHistory[0] = castingGold, gramHistory[1] = remaining after Filing, etc.
    gramHistory: { type: [Number], default: [] },

    // ── Step 0 sub-steps (Design & Wax) ──────────────────────────────────────
    designDone: { type: Boolean, default: false },
    waxDone:    { type: Boolean, default: false },

    // ── Casting step ──────────────────────────────────────────────────────────
    castingGold: { type: Number, default: 0 }, // grams allocated at casting

    // ── Owner gold usage ──────────────────────────────────────────────────────
    usesOwnerGold: { type: Boolean, default: false }, // true if customer had 0 gold
    ownerId:       { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },

    // ── Billing PDF ───────────────────────────────────────────────────────────
    billingData: { type: billingDataSchema, default: null },
  },
  { timestamps: true }
);

orderSchema.set("toJSON",   { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
