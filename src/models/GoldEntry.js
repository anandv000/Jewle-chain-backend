const mongoose = require("mongoose");

const goldItemSchema = new mongoose.Schema({
  sr:          { type: Number },
  item:        { type: String, default: "" },
  shape:       { type: String, default: "" },
  quality:     { type: String, default: "" },
  accessories: { type: String, default: "" },
  size:        { type: String, default: "" },
  description: { type: String, default: "" },
  pieces:      { type: Number, default: 0 },
  weight:      { type: Number, default: 0 },
  pureWt:      { type: Number, default: 0 },
}, { _id: true });

const diamondShapeRow = new mongoose.Schema({
  shapeId:   { type: String, default: "" },
  shapeName: { type: String, default: "" },
  sizeInMM:  { type: String, default: "" },
  pcs:       { type: Number, default: 0 },
  karats:    { type: Number, required: true },
}, { _id: false });

const goldEntrySchema = new mongoose.Schema(
  {
    receiptNo:  { type: String, unique: true },
    entryType:  {
      type: String,
      // gold_deposit  = customer brings gold
      // silver_deposit = customer brings silver   ← NEW
      // diamond_deposit = customer brings diamonds
      // return         = returning any material back to customer
      enum: ["gold_deposit", "silver_deposit", "diamond_deposit", "return"],
      default: "gold_deposit",
    },

    customer:       { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName:   { type: String },
    customerPhone:  { type: String },
    partyVoucherNo: { type: String, default: "" },
    date:           { type: Date, default: Date.now },
    remark:         { type: String, default: "" },
    whatsappSent:   { type: Boolean, default: false },

    // ── Gold / Silver deposit fields (shared schema) ──────────────────────────
    items:        { type: [goldItemSchema], default: [] },
    totalWeight:  { type: Number, default: 0 },
    totalPureWt:  { type: Number, default: 0 },

    // ── Diamond deposit fields ────────────────────────────────────────────────
    diamonds:           { type: [diamondShapeRow], default: [] },
    totalDiamondPcs:    { type: Number, default: 0 },
    totalDiamondKarats: { type: Number, default: 0 },

    // ── Return fields ─────────────────────────────────────────────────────────
    returnGold:          { type: Number, default: 0 },   // grams gold returned
    returnSilver:        { type: Number, default: 0 },   // grams silver returned ← NEW
    returnDiamonds:      { type: [diamondShapeRow], default: [] },
    returnDiamondKarats: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GoldEntry", goldEntrySchema);
