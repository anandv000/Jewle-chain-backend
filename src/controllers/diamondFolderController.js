const DiamondFolder = require("../models/DiamondFolder");

// GET /api/diamond-folders
const getAllFolders = async (req, res, next) => {
  try {
    const folders = await DiamondFolder.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: folders });
  } catch (err) { next(err); }
};

// POST /api/diamond-folders
const createFolder = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Folder name is required" });
    const folder = await DiamondFolder.create({ name: name.trim() });
    res.status(201).json({ success: true, data: folder });
  } catch (err) { next(err); }
};

// DELETE /api/diamond-folders/:id
const deleteFolder = async (req, res, next) => {
  try {
    const folder = await DiamondFolder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });
    res.status(200).json({ success: true, message: "Folder deleted" });
  } catch (err) { next(err); }
};

// POST /api/diamond-folders/:id/diamonds
const addDiamond = async (req, res, next) => {
  try {
    const folder = await DiamondFolder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const { name, sizeInMM, weight } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Diamond name is required" });

    const isDupe = folder.diamonds.some(d => d.name.toLowerCase() === name.trim().toLowerCase());
    if (isDupe) return res.status(400).json({ success: false, error: `"${name}" already exists in this folder.` });

    folder.diamonds.push({ name: name.trim(), sizeInMM: sizeInMM || "", weight: parseFloat(weight) || 0 });
    await folder.save();

    res.status(201).json({ success: true, data: folder.diamonds[folder.diamonds.length - 1] });
  } catch (err) { next(err); }
};

// PUT /api/diamond-folders/:id/diamonds/:diamondId
const updateDiamond = async (req, res, next) => {
  try {
    const folder = await DiamondFolder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const diamond = folder.diamonds.id(req.params.diamondId);
    if (!diamond) return res.status(404).json({ success: false, error: "Diamond not found" });

    const { name, sizeInMM, weight } = req.body;
    if (name)        diamond.name     = name.trim();
    if (sizeInMM !== undefined) diamond.sizeInMM = sizeInMM;
    if (weight !== undefined)   diamond.weight   = parseFloat(weight) || 0;

    await folder.save();
    res.status(200).json({ success: true, data: diamond });
  } catch (err) { next(err); }
};

// DELETE /api/diamond-folders/:id/diamonds/:diamondId
const removeDiamond = async (req, res, next) => {
  try {
    const folder = await DiamondFolder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const diamond = folder.diamonds.id(req.params.diamondId);
    if (!diamond) return res.status(404).json({ success: false, error: "Diamond not found" });

    diamond.deleteOne();
    await folder.save();
    res.status(200).json({ success: true, message: "Diamond removed" });
  } catch (err) { next(err); }
};

module.exports = { getAllFolders, createFolder, deleteFolder, addDiamond, updateDiamond, removeDiamond };
