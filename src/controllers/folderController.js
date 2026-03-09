const path    = require("path");
const fs      = require("fs");
const Folder  = require("../models/Folder");
const Counter = require("../models/Counter");

// ── GET /api/folders ──────────────────────────────────────────────────────────
const getAllFolders = async (req, res, next) => {
  try {
    const folders = await Folder.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: folders });
  } catch (err) { next(err); }
};

// ── POST /api/folders ─────────────────────────────────────────────────────────
const createFolder = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Folder name is required" });
    const folder = await Folder.create({ name: name.trim() });
    res.status(201).json({ success: true, data: folder });
  } catch (err) { next(err); }
};

// ── DELETE /api/folders/:id ───────────────────────────────────────────────────
const deleteFolder = async (req, res, next) => {
  try {
    const folder = await Folder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    folder.items.forEach(item => {
      if (item.image) {
        const fp = path.join(__dirname, "../uploads", path.basename(item.image));
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    });

    res.status(200).json({ success: true, message: "Folder deleted" });
  } catch (err) { next(err); }
};

// ── POST /api/folders/:id/items ───────────────────────────────────────────────
const addItem = async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const { name, weight, desc } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Item name is required" });

    // Duplicate check
    const isDupe = folder.items.some(it => it.name.toLowerCase() === name.trim().toLowerCase());
    if (isDupe) return res.status(400).json({ success: false, error: `"${name}" already exists in this folder.` });

    // ── Auto item number: a101, a102 … ──────────────────────────────────────
    const seq        = await Counter.getNext("itemNumber");
    const itemNumber = `a${100 + seq}`; // seq=1→a101, seq=2→a102 …

    // ── Image URL ─────────────────────────────────────────────────────────────
    let imageUrl = null;
    if (req.file) {
      imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    folder.items.push({
      itemNumber,
      name:   name.trim(),
      weight: parseFloat(weight) || 0,
      desc:   desc || "",
      image:  imageUrl,
      addedAt: new Date(),
    });
    await folder.save();

    const added = folder.items[folder.items.length - 1];
    res.status(201).json({ success: true, data: added });
  } catch (err) { next(err); }
};

// ── DELETE /api/folders/:folderId/items/:itemId ───────────────────────────────
const removeItem = async (req, res, next) => {
  try {
    const folder = await Folder.findById(req.params.folderId);
    if (!folder) return res.status(404).json({ success: false, error: "Folder not found" });

    const item = folder.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, error: "Item not found" });

    if (item.image) {
      const fp = path.join(__dirname, "../uploads", path.basename(item.image));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    item.deleteOne();
    await folder.save();

    res.status(200).json({ success: true, message: "Item removed" });
  } catch (err) { next(err); }
};

module.exports = { getAllFolders, createFolder, deleteFolder, addItem, removeItem };
