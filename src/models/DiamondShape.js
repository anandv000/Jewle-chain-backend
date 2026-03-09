const mongoose = require("mongoose");

const diamondShapeSchema = new mongoose.Schema(
  {
    name:     { type: String, required: [true, "Diamond name is required"], trim: true },
    sizeInMM: { type: String, trim: true, default: "" },   // e.g. "3.5 mm"
    weight:   { type: Number, default: 0 },                 // in carats
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiamondShape", diamondShapeSchema);
