const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name:     { type: String, required: [true, "Name is required"], trim: true },
    company:  { type: String, trim: true, default: "" },
    phone:    { type: String, required: [true, "Phone is required"], trim: true },
    gold:       { type: Number, default: 0, min: 0 },
    goldCarats: { type: Number, default: 0, min: 0 }, // ← NEW: gold carats manual
    diamonds:   { type: Number, default: 0, min: 0 }, // diamond pieces
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
