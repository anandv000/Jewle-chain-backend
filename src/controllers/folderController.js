const Folder  = require("../models/Folder");
const Counter = require("../models/Counter");

// GET /api/folders
const getAllFolders = async (req, res, next) => {
  try {
    const folders = await Folder.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: folders });
  } catch (err) { next(err); }
};

// POST /api/folders
const createFolder = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Folder name is required" });
    const folder = await Folder.create({ name: name.trim() });
    res.status(201).json({ success: true, data: folder });
  } catch (err) { next(err); }
};

// DELETE /api/folders/:id
const deleteFolder = async (req, res, next) => {
  try {
    const folder = await Folder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });
    res.status(200).json({ success: true, message: "Folder deleted" });
  } catch (err) { next(err); }
};

// POST /api/folders/:id/items
const addItem = async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const { name, weight, netWeight, purity, tone, gender, designedBy, desc, diamonds } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Item name is required" });

    const isDupe = folder.items.some(it => it.name.toLowerCase() === name.trim().toLowerCase());
    if (isDupe) return res.status(400).json({ success: false, error: `"${name}" already exists in this folder.` });

    // Auto item number: a101, a102 …
    const seq        = await Counter.getNext("itemNumber");
    const itemNumber = `a${100 + seq}`;

    // Image → base64 data URL in MongoDB (no disk write — works on Vercel)
    let imageUrl = null;
    if (req.file && req.file.buffer) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    // Diamonds — JSON string from FormData
    let parsedDiamonds = [];
    if (diamonds) {
      try { parsedDiamonds = JSON.parse(diamonds); } catch { parsedDiamonds = []; }
    }

    folder.items.push({
      itemNumber,
      name:       name.trim(),
      weight:     parseFloat(weight)    || 0,
      netWeight:  parseFloat(netWeight) || 0,
      purity:     purity     || "",
      tone:       tone       || "",
      gender:     gender     || "Unisex",
      designedBy: designedBy || "",
      desc:       desc       || "",
      image:      imageUrl,
      diamonds:   parsedDiamonds,
      addedAt:    new Date(),
    });
    await folder.save();

    res.status(201).json({ success: true, data: folder.items[folder.items.length - 1] });
  } catch (err) { next(err); }
};

// DELETE /api/folders/:folderId/items/:itemId
const removeItem = async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.folderId);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const item = folder.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, error: "Item not found" });

    item.deleteOne();
    await folder.save();
    res.status(200).json({ success: true, message: "Item removed" });
  } catch (err) { next(err); }
};

module.exports = { getAllFolders, createFolder, deleteFolder, addItem, removeItem };
