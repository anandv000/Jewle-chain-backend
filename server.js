require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

const connectDB           = require("./src/config/db");
const { seedHost }        = require("./src/controllers/hostController");
const authRoutes          = require("./src/routes/authRoutes");
const hostRoutes          = require("./src/routes/hostRoutes");
const adminRoutes         = require("./src/routes/adminRoutes");
const customerRoutes      = require("./src/routes/customerRoutes");
const folderRoutes        = require("./src/routes/folderRoutes");
const orderRoutes         = require("./src/routes/orderRoutes");
const diamondShapeRoutes  = require("./src/routes/diamondShapeRoutes");
const diamondFolderRoutes = require("./src/routes/diamondFolderRoutes");
const goldEntryRoutes     = require("./src/routes/goldEntryRoutes");
const goldRecoveryRoutes  = require("./src/routes/goldRecoveryRoutes");
const errorHandler        = require("./src/middleware/errorHandler");

// ── Connect DB + seed host ────────────────────────────────────────────────────
connectDB()
  .then(async (conn) => {
    if (!conn) { console.warn("⚠️  Continuing without database..."); return; }
    await seedHost();
    try {
      const mongoose = require("mongoose");
      const userColl = mongoose.connection.collection("users");
      const indexes  = await userColl.getIndexes();
      for (const [name, details] of Object.entries(indexes)) {
        if (details.key?.username === 1) {
          await userColl.dropIndex(name);
          console.log(`🧹 Dropped stale index "${name}"`);
        }
      }
    } catch (e) { console.warn("Index cleanup:", e.message); }
  })
  .catch((e) => console.error("DB error:", e.message));

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [process.env.CLIENT_URL, "http://localhost:3000"].filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
};
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json({ limit:"15mb" }));
app.use(express.urlencoded({ extended:true, limit:"15mb" }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",            authRoutes);
app.use("/api/host",            hostRoutes);
app.use("/api/admin",           adminRoutes);
app.use("/api/customers",       customerRoutes);
app.use("/api/folders",         folderRoutes);
app.use("/api/orders",          orderRoutes);
app.use("/api/diamonds",        diamondShapeRoutes);
app.use("/api/diamond-folders", diamondFolderRoutes);
app.use("/api/gold-entries",    goldEntryRoutes);
app.use("/api/gold-recovery",   goldRecoveryRoutes);

app.get("/api/health", (_req, res) => {
  const mongoose = require("mongoose");
  res.json({ success:true, message:"AtelierGold API ✦", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// ── Diagnostic: Check host user status ──────────────────────────────────────
app.get("/api/host/status", async (_req, res) => {
  try {
    const User = require("./src/models/User");
    const host = await User.findOne({ role: "host" }).select("-password");
    if (!host) {
      return res.json({ success: true, host: null, message: "Host user not found in database" });
    }
    res.json({ success: true, host: { email: host.email, name: host.name, isActive: host.isActive, isVerified: host.isVerified, role: host.role } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use((_req, res) => res.status(404).json({ success:false, error:"Route not found" }));
app.use(errorHandler);

module.exports = app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`\n✦ AtelierGold API  🚀  http://localhost:${PORT}\n`));
}
