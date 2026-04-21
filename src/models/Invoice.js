const mongoose = require("mongoose");

// ── Sub-schemas ───────────────────────────────────────────────────────────────
const diamondLineSchema = new mongoose.Schema({
  shape: { type: String, default: "" },
  size:  { type: String, default: "" },
  pcs:   { type: Number, default: 0  },
  wt:    { type: Number, default: 0  },
  rate:  { type: Number, default: 0  },
  amt:   { type: Number, default: 0  },
}, { _id: false });

const stoneLineSchema = new mongoose.Schema({
  shape: { type: String, default: "" },
  size:  { type: String, default: "" },
  pcs:   { type: Number, default: 0  },
  wt:    { type: Number, default: 0  },
  rate:  { type: Number, default: 0  },
  amt:   { type: Number, default: 0  },
}, { _id: false });

const invoiceItemSchema = new mongoose.Schema({
  // Link to order (optional — can also enter manually)
  orderId:  { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  bagId:    { type: String, default: "" },

  // Item info
  design:   { type: String, default: "" },
  category: { type: String, default: "" }, // NECKLACE, RING, etc.
  qty:      { type: Number, default: 1   },

  // Metal
  karat:       { type: String, default: "" },    // "18", "22", "S925"
  finePercent: { type: Number, default: 0  },    // purity % e.g. 75 for 18K
  grossWt:     { type: Number, default: 0  },
  netWt:       { type: Number, default: 0  },
  fineWt:      { type: Number, default: 0  },    // netWt * finePercent / 100
  metalRate:   { type: Number, default: 0  },
  metalAmt:    { type: Number, default: 0  },

  // Labour
  labourRate:  { type: Number, default: 0  },
  labourAmt:   { type: Number, default: 0  },

  // Diamonds
  diamonds: { type: [diamondLineSchema], default: [] },

  // Stones (separate from diamonds)
  stones: { type: [stoneLineSchema], default: [] },

  // Other
  otherDescr: { type: String, default: "" },
  otherAmt:   { type: Number, default: 0  },

  // Line total
  lineTotal: { type: Number, default: 0 },
}, { _id: false });

// ── Main Invoice Schema ───────────────────────────────────────────────────────
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo:   { type: String, unique: true },   // e.g. "JB/25_26-3169"
    invoiceType: {
      type: String,
      enum: ["estimate", "tax", "proforma"],
      default: "estimate",
    },
    date:         { type: Date, default: Date.now },
    customer:     { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, default: "" },

    // ── Line items ────────────────────────────────────────────────────────────
    items: { type: [invoiceItemSchema], default: [] },

    remarks: { type: String, default: "" },

    // ── Other charges (bottom section of PDF) ─────────────────────────────────
    otherCharges: {
      hallMarking: { type: Number, default: 0 },
      certy:       { type: Number, default: 0 },
      shipping:    { type: Number, default: 0 },
      addLess:     { type: Number, default: 0 },
    },

    // ── Computed invoice summary ───────────────────────────────────────────────
    totalGrossWt:    { type: Number, default: 0 },
    totalNetWt:      { type: Number, default: 0 },
    totalFineWt:     { type: Number, default: 0 },
    totalDiamondPcs: { type: Number, default: 0 },
    totalDiamondWt:  { type: Number, default: 0 },
    totalStonePcs:   { type: Number, default: 0 },
    totalStoneWt:    { type: Number, default: 0 },
    totalMetalAmt:   { type: Number, default: 0 },
    totalLabourAmt:  { type: Number, default: 0 },
    totalDiamondAmt: { type: Number, default: 0 },
    totalStoneAmt:   { type: Number, default: 0 },
    totalOtherAmt:   { type: Number, default: 0 },
    making:          { type: Number, default: 0 }, // labour total
    grandTotal:      { type: Number, default: 0 },

    // ── Balance summary ────────────────────────────────────────────────────────
    creditAmount: { type: Number, default: 0 },
    debitAmount:  { type: Number, default: 0 },
    metalBalance: { type: Number, default: 0 }, // metal grams balance
    cdmdWt:       { type: Number, default: 0 }, // certified diamond/metal wt

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "sent", "paid"],
      default: "draft",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
