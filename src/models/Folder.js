const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    itemNumber: { type: String, default: "" },   // e.g. "a101" — auto-generated
    name:       { type: String, required: true, trim: true },
    weight:     { type: Number, default: 0 },
    desc:       { type: String, trim: true, default: "" },
    image:      { type: String, default: null },
    addedAt:    { type: Date,   default: Date.now }, // auto date/time when item added
  },
  { _id: true }
);

const folderSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true, unique: true },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Folder", folderSchema);
