const mongoose = require("mongoose");

// Diamond used inside a product item
const diamondUsedSchema = new mongoose.Schema({
  diamondId:   { type: String, default: "" },
  diamondName: { type: String, default: "" },
  folderName:  { type: String, default: "" },
  sizeInMM:    { type: String, default: "" },
  weightPerPc: { type: Number, default: 0 }, // carats per piece
  pcs:         { type: Number, default: 1 },
  totalKarats: { type: Number, default: 0 }, // pcs × weightPerPc
}, { _id: false });

const itemSchema = new mongoose.Schema({
  itemNumber:  { type: String, default: "" },
  name:        { type: String, required: true, trim: true },
  weight:      { type: Number, default: 0 },             // gross weight (grams)
  netWeight:   { type: Number, default: 0 },             // net weight (grams)
  purity:      { type: String, default: "" },            // e.g. "18K", "22K"
  tone:        { type: String, default: "" },            // e.g. "Yellow Gold"
  gender:      { type: String, enum: ["Gents", "Ladies", "Kids", "Unisex"], default: "Unisex" },
  designedBy:  { type: String, default: "" },
  desc:        { type: String, trim: true, default: "" },
  image:       { type: String, default: null },          // base64 data URL
  diamonds:    { type: [diamondUsedSchema], default: [] },
  addedAt:     { type: Date, default: Date.now },
}, { _id: true });

const folderSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, unique: true },
  items: { type: [itemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("Folder", folderSchema);
