const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name:          { type: String, required: [true, "Name is required"], trim: true },
    company:       { type: String, trim: true, default: "" },
    phone:         { type: String, required: [true, "Phone is required"], trim: true },
    gold:          { type: Number, default: 0, min: 0 }, // total gold grams deposited
    goldCarats:    { type: Number, default: 0, min: 0 }, // manual gold carats
    diamonds:      { type: Number, default: 0, min: 0 }, // total diamond pcs deposited
    diamondKarats: { type: Number, default: 0, min: 0 }, // total diamond karats deposited
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
