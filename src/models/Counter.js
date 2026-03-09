const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: String,          // e.g. "itemNumber" | "bagId_2026"
  seq: { type: Number, default: 0 },
});

// Atomically increment and return next value
counterSchema.statics.getNext = async function (id) {
  const doc = await this.findByIdAndUpdate(
    id,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model("Counter", counterSchema);
