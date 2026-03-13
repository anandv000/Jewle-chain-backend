require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

const connectDB          = require("./src/config/db");
const authRoutes         = require("./src/routes/authRoutes");
const customerRoutes     = require("./src/routes/customerRoutes");
const folderRoutes       = require("./src/routes/folderRoutes");
const orderRoutes        = require("./src/routes/orderRoutes");
const diamondShapeRoutes = require("./src/routes/diamondShapeRoutes");
const goldEntryRoutes    = require("./src/routes/goldEntryRoutes");
const errorHandler       = require("./src/middleware/errorHandler");

// ── Initialize DB connection (don't block app startup) ────────────────────────
connectDB()
  .then(async (conn) => {
    if (!conn) {
      console.warn("⚠️  Continuing without database...");
      return;
    }
    try {
      const mongoose = require("mongoose");
      const userColl = mongoose.connection.collection("users");
      const indexes  = await userColl.getIndexes();
      for (const [indexName, indexDetails] of Object.entries(indexes)) {
        if (indexDetails.key && indexDetails.key.username === 1) {
          await userColl.dropIndex(indexName);
          console.log(`🧹 Dropped stale index "${indexName}" from users collection`);
        }
      }
    } catch (err) {
      console.warn(`⚠️  Could not clean indexes: ${err.message}`);
    }
  })
  .catch((err) => {
    console.error(`❌ DB cleanup failed: ${err.message}`);
  });

const app = express();

// ── CORS — allow your Vercel frontend + localhost ─────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Postman, mobile apps, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Body parsers — 15 MB limit to handle base64 images ───────────────────────
// Images are stored as base64 strings in MongoDB (no file system writes)
// so the JSON payload can be larger than the default 10mb
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// ── NO static /uploads needed ─────────────────────────────────────────────────
// Images are base64 data URLs stored directly in MongoDB.
// Vercel filesystem is read-only so we never write files to disk.

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/customers",    customerRoutes);
app.use("/api/folders",      folderRoutes);
app.use("/api/orders",       orderRoutes);
app.use("/api/diamonds",     diamondShapeRoutes);
app.use("/api/gold-entries", goldEntryRoutes);

// Health check — shows DB status
app.get("/api/health", (_req, res) => {
  const mongoose   = require("mongoose");
  const dbConnected = mongoose.connection.readyState === 1;
  res.json({
    success: true,
    message: "AtelierGold API ✦",
    database: dbConnected ? "connected" : "disconnected",
  });
});

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));

// Error handler
app.use(errorHandler);

// ── Export for Vercel serverless ──────────────────────────────────────────────
module.exports = app;

// ── Local development server ──────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n✦  AtelierGold API v3`);
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`📦 ${process.env.NODE_ENV || "development"}\n`);
  });
}
