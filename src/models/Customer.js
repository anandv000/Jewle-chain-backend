const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name:    { type: String, required: [true, "Name is required"], trim: true },
    company: { type: String, trim: true, default: "" },
    phone:   { type: String, required: [true, "Phone is required"], trim: true },

    // ── Metals ────────────────────────────────────────────────────────────────
    gold:       { type: Number, default: 0, min: 0 },
    goldCarats: { type: Number, default: 0, min: 0 },
    silver:     { type: Number, default: 0, min: 0 },

    // ── Labour rates (₹ per gram) set on customer, auto-used in orders ────────
    labourRateGold:   { type: Number, default: 0, min: 0 },
    labourRateSilver: { type: Number, default: 0, min: 0 },

    // ── Diamonds ──────────────────────────────────────────────────────────────
    diamonds:      { type: Number, default: 0, min: 0 },
    diamondKarats: { type: Number, default: 0, min: 0 },

    // ── Owner flag ────────────────────────────────────────────────────────────
    isOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
