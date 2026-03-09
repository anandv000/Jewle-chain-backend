const DiamondShape = require("../models/DiamondShape");

// GET /api/diamonds
const getAll = async (req, res, next) => {
  try {
    const shapes = await DiamondShape.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: shapes });
  } catch (err) { next(err); }
};

// POST /api/diamonds
const create = async (req, res, next) => {
  try {
    const { name, sizeInMM, weight } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Diamond name is required" });
    const shape = await DiamondShape.create({ name: name.trim(), sizeInMM: sizeInMM || "", weight: parseFloat(weight) || 0 });
    res.status(201).json({ success: true, data: shape });
  } catch (err) { next(err); }
};

// PUT /api/diamonds/:id
const update = async (req, res, next) => {
  try {
    const { name, sizeInMM, weight } = req.body;
    const shape = await DiamondShape.findByIdAndUpdate(
      req.params.id,
      { name, sizeInMM, weight: parseFloat(weight) || 0 },
      { new: true, runValidators: true }
    );
    if (!shape) return res.status(404).json({ success: false, error: "Diamond shape not found" });
    res.status(200).json({ success: true, data: shape });
  } catch (err) { next(err); }
};

// DELETE /api/diamonds/:id
const remove = async (req, res, next) => {
  try {
    const shape = await DiamondShape.findByIdAndDelete(req.params.id);
    if (!shape) return res.status(404).json({ success: false, error: "Diamond shape not found" });
    res.status(200).json({ success: true, message: "Diamond shape deleted" });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, remove };
