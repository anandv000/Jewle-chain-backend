const mongoose = require("mongoose");

const goldRecoverySchema = new mongoose.Schema(
  {
    grams:  { type: Number, required: true, min: 0 },
    source: { type: String, required: true, trim: true },
    date:   { type: Date, default: Date.now },
    note:   { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GoldRecovery", goldRecoverySchema);
