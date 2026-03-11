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

const goldEntrySchema = new mongoose.Schema(
  {
    receiptNo:      { type: String, unique: true },   // e.g. PRG/25-26/0001
    customer:       { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName:   { type: String },
    customerPhone:  { type: String },
    partyVoucherNo: { type: String, default: "" },
    date:           { type: Date, default: Date.now },
    items:          { type: [goldItemSchema], default: [] },
    remark:         { type: String, default: "" },
    totalWeight:    { type: Number, default: 0 },
    totalPureWt:    { type: Number, default: 0 },
    whatsappSent:   { type: Boolean, default: false },
    pdfPath:        { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GoldEntry", goldEntrySchema);
