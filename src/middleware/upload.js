const multer = require("multer");

// ── Memory storage — NO disk writes (required for Vercel / read-only hosts) ──
// Files arrive as req.file.buffer (Buffer) instead of req.file.path
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

module.exports = upload;
