require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

const connectDB           = require("./src/config/db");
const authRoutes          = require("./src/routes/authRoutes");
const customerRoutes      = require("./src/routes/customerRoutes");
const folderRoutes        = require("./src/routes/folderRoutes");
const orderRoutes         = require("./src/routes/orderRoutes");
const diamondShapeRoutes  = require("./src/routes/diamondShapeRoutes");
const diamondFolderRoutes = require("./src/routes/diamondFolderRoutes");
const goldEntryRoutes     = require("./src/routes/goldEntryRoutes");
const errorHandler        = require("./src/middleware/errorHandler");

// ── Connect DB ────────────────────────────────────────────────────────────────
connectDB()
  .then(async (conn) => {
    if (!conn) { console.warn("⚠️  Continuing without database..."); return; }
    try {
      const mongoose = require("mongoose");
      const userColl = mongoose.connection.collection("users");
      const indexes  = await userColl.getIndexes();
      for (const [indexName, indexDetails] of Object.entries(indexes)) {
        if (indexDetails.key && indexDetails.key.username === 1) {
          await userColl.dropIndex(indexName);
          console.log(`🧹 Dropped stale index "${indexName}"`);
        }
      }
    } catch (err) { console.warn(`⚠️  Could not clean indexes: ${err.message}`); }
  })
  .catch((err) => { console.error(`❌ DB cleanup failed: ${err.message}`); });

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ── This line fixes 405 on Vercel — handles OPTIONS preflight ─────────────────
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",            authRoutes);
app.use("/api/customers",       customerRoutes);
app.use("/api/folders",         folderRoutes);
app.use("/api/orders",          orderRoutes);
app.use("/api/diamonds",        diamondShapeRoutes);
app.use("/api/diamond-folders", diamondFolderRoutes);
app.use("/api/gold-entries",    goldEntryRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  const mongoose    = require("mongoose");
  const dbConnected = mongoose.connection.readyState === 1;
  res.json({
    success:  true,
    message:  "AtelierGold API ✦",
    database: dbConnected ? "connected" : "disconnected",
  });
});

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));
app.use(errorHandler);

// ── IMPORTANT: Export for Vercel serverless ───────────────────────────────────
module.exports = app;

// ── Local dev only ────────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n✦  AtelierGold API v3`);
    console.log(`🚀 http://localhost:${PORT}\n`);
  });
}
