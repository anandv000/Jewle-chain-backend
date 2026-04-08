const GoldRecovery = require("../models/GoldRecovery");

// GET /api/gold-recovery
const getAll = async (req, res, next) => {
  try {
    const entries = await GoldRecovery.find().sort({ date: -1 });
    res.status(200).json({ success: true, data: entries });
  } catch (err) { next(err); }
};

// POST /api/gold-recovery
const create = async (req, res, next) => {
  try {
    const { grams, source, date, note } = req.body;
    if (!grams || parseFloat(grams) <= 0)
      return res.status(400).json({ success: false, error: "Grams must be greater than 0." });
    if (!source?.trim())
      return res.status(400).json({ success: false, error: "Recovery source is required." });

    const entry = await GoldRecovery.create({
      grams:  parseFloat(grams),
      source: source.trim(),
      date:   date ? new Date(date) : new Date(),
      note:   note || "",
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// DELETE /api/gold-recovery/:id
const remove = async (req, res, next) => {
  try {
    const entry = await GoldRecovery.findByIdAndDelete(req.params.id);
    if (!entry)
      return res.status(404).json({ success: false, error: "Entry not found." });
    res.status(200).json({ success: true, message: "Deleted." });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, remove };
