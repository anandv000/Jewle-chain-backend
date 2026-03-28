const mongoose = require("mongoose");

const diamondEntrySchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true }, // e.g. "Oval 3mm"
  sizeInMM: { type: String, default: "" },
  weight:   { type: Number, default: 0 },                 // per piece, in carats
  addedAt:  { type: Date,   default: Date.now },
}, { _id: true });

const diamondFolderSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, unique: true }, // e.g. "Oval"
  diamonds: { type: [diamondEntrySchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("DiamondFolder", diamondFolderSchema);
