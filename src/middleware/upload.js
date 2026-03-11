const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

// On Vercel, use /tmp (read-write). Locally, use src/uploads
const UPLOAD_DIR = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, "../uploads");

// Only try to create directory on local environment (Vercel /tmp is pre-created)
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `item-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/avif"];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only JPG, PNG and AVIF images are allowed"), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = upload;
