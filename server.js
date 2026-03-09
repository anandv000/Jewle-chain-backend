require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const path    = require("path");

const connectDB           = require("./src/config/db");
const authRoutes          = require("./src/routes/authRoutes");
const customerRoutes      = require("./src/routes/customerRoutes");
const folderRoutes        = require("./src/routes/folderRoutes");
const orderRoutes         = require("./src/routes/orderRoutes");
const diamondShapeRoutes  = require("./src/routes/diamondShapeRoutes");
const goldEntryRoutes     = require("./src/routes/goldEntryRoutes");
const errorHandler        = require("./src/middleware/errorHandler");

// ── Connect DB then drop any stale indexes ────────────────────────────────────
connectDB().then(async () => {
  try {
    const mongoose = require("mongoose");
    const userColl = mongoose.connection.collection("users");
    const indexes  = await userColl.indexes();
    for (const idx of indexes) {
      // Drop the old unique "username_1" index that blocks second user registration
      if (idx.key && idx.key.username !== undefined) {
        await userColl.dropIndex(idx.name);
        console.log(`🧹 Dropped stale index "${idx.name}" from users collection`);
      }
    }
  } catch (_) { /* silent on first run — collection may not exist yet */ }
}).catch(() => {});

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Static uploads
app.use("/uploads",          express.static(path.join(__dirname, "src/uploads")));
app.use("/uploads/receipts", express.static(path.join(__dirname, "src/uploads/receipts")));

// Routes
app.use("/api/auth",         authRoutes);
app.use("/api/customers",    customerRoutes);
app.use("/api/folders",      folderRoutes);
app.use("/api/orders",       orderRoutes);
app.use("/api/diamonds",     diamondShapeRoutes);
app.use("/api/gold-entries", goldEntryRoutes);

// Health
app.get("/api/health", (_req, res) => res.json({ success: true, message: "AtelierGold API ✦" }));

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✦  AtelierGold API v3`);
  console.log(`🚀 http://localhost:${PORT}`);
  console.log(`📦 ${process.env.NODE_ENV || "development"}\n`);
});
