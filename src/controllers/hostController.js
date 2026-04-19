const jwt    = require("jsonwebtoken");
const User   = require("../models/User");

const HOST_EMAIL = "anandkautilyam@gmail.com";
const HOST_PASS  = "Anshu@0711";

// ── ALL_PERMISSIONS fallback ───────────────────────────────────────────────────
const ALL_PERMS = [
  "dashboard","admin-stock","customers","products",
  "diamonds","create-order","bag","wastage","ledger","bag-status",
];

const safeUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone,
  role: u.role, permissions: u.permissions || ALL_PERMS,
  isActive: u.isActive, isVerified: u.isVerified,
  workspace: u.workspace, createdBy: u.createdBy,
  createdAt: u.createdAt,
});

// ── seedHost ──────────────────────────────────────────────────────────────────
// Called on server startup. Finds user by EMAIL (not role) to handle the case
// where the email already exists as admin → upgrades to host role.
const seedHost = async () => {
  try {
    // Search by email regardless of role — handles migration
    let host = await User.findOne({ email: HOST_EMAIL.toLowerCase() });

    if (!host) {
      // Brand new — create host
      host = await User.create({
        name: "Atelier Gold Host",
        email: HOST_EMAIL,
        phone: "",
        password: HOST_PASS,          // pre-save hook hashes this
        role: "host",
        isActive: true,
        isVerified: true,
        permissions: ALL_PERMS,
      });
      console.log("✦ Host user created:", HOST_EMAIL);

    } else {
      // User exists — ensure host role + active + verified
      const updates = {};
      if (host.role !== "host")   updates.role       = "host";
      if (!host.isActive)         updates.isActive    = true;
      if (!host.isVerified)       updates.isVerified  = true;

      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: host._id }, { $set: updates });
        console.log("✦ Host role/status fixed:", HOST_EMAIL, updates);
      }

      // Verify password is correct; reset if not
      const pwOk = await host.matchPassword(HOST_PASS);
      if (!pwOk) {
        host.password = HOST_PASS;    // pre-save hook hashes this
        await host.save();
        console.log("✦ Host password reset:", HOST_EMAIL);
      } else {
        console.log("✦ Host user OK:", HOST_EMAIL);
      }
    }
  } catch (err) {
    console.warn("Host seed failed:", err.message);
  }
};

// ── setupHost  GET /api/host/setup ────────────────────────────────────────────
// Emergency reset — deletes existing host and recreates.
const setupHost = async (req, res, next) => {
  try {
    await User.deleteMany({ role: "host" });
    const host = await User.create({
      name: "Atelier Gold Host",
      email: HOST_EMAIL,
      phone: "",
      password: HOST_PASS,
      role: "host",
      isActive: true,
      isVerified: true,
      permissions: ALL_PERMS,
    });
    console.log("✓ Host reset:", host.email);
    res.json({ success: true, message: "Host reset complete", data: safeUser(host) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/host/login ──────────────────────────────────────────────────────
// Robust login:
//  1. Compare credentials against hardcoded values first (no bcrypt needed here)
//  2. Find user by email ONLY (not role) — handles migration from admin → host
//  3. Upgrade role / fix status if needed using updateOne (no pre-save rehash)
//  4. Create user if completely missing
//  5. Issue JWT
const hostLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Step 1: Verify against hardcoded credentials ───────────────────────
    if (normalizedEmail !== HOST_EMAIL.toLowerCase() || password !== HOST_PASS) {
      return res.status(401).json({ success: false, error: "Invalid host credentials" });
    }

    // ── Step 2: Find user by email (any role) ─────────────────────────────
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // ── Step 3a: Create fresh host user ───────────────────────────────
      try {
        user = await User.create({
          name: "Atelier Gold Host",
          email: HOST_EMAIL,
          phone: "",
          password: HOST_PASS,   // pre-save hashes
          role: "host",
          isActive: true,
          isVerified: true,
          permissions: ALL_PERMS,
        });
        console.log("✦ Host created on first login:", HOST_EMAIL);
      } catch (createErr) {
        if (createErr.code === 11000) {
          // Race condition — another request created it; try again
          user = await User.findOne({ email: normalizedEmail });
        } else {
          throw createErr;
        }
      }
    }

    if (!user) {
      // Still null after all attempts
      return res.status(500).json({ success: false, error: "Failed to create host user. Check DB connection." });
    }

    // ── Step 3b: Fix role / status if wrong (no password re-hash) ─────────
    const needsFix = user.role !== "host" || !user.isActive || !user.isVerified;
    if (needsFix) {
      await User.updateOne(
        { _id: user._id },
        { $set: { role: "host", isActive: true, isVerified: true } }
      );
      user.role       = "host";
      user.isActive   = true;
      user.isVerified = true;
      console.log("✦ Host role/status upgraded for:", normalizedEmail);
    }

    // ── Step 4: Issue token ────────────────────────────────────────────────
    const token = jwt.sign(
      { id: user._id, role: "host" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("✓ Host login success:", normalizedEmail);
    return res.json({ success: true, data: { ...safeUser(user), token } });

  } catch (err) {
    console.error("Host login error:", err.message);
    next(err);
  }
};

// ── GET /api/host/admins ──────────────────────────────────────────────────────
const getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: "admin" }).sort({ createdAt: -1 });
    res.json({ success: true, data: admins.map(safeUser) });
  } catch (err) { next(err); }
};

// ── POST /api/host/admins ─────────────────────────────────────────────────────
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: "Name, email, password required" });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(400).json({ success: false, error: "Email already registered" });

    const user = await User.create({
      name, email, phone: phone || "", password,
      role: "admin",
      isActive: true, isVerified: true,
      createdBy: req.user._id,
      permissions: ALL_PERMS,
    });
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
};

// ── GET /api/host/users ───────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: "host" } }).sort({ createdAt: -1 });
    res.json({ success: true, data: users.map(safeUser) });
  } catch (err) { next(err); }
};

// ── PATCH /api/host/users/:id/toggle-active ───────────────────────────────────
const toggleActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (user.role === "host") return res.status(403).json({ success: false, error: "Cannot modify host" });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
};

// ── PATCH /api/host/users/:id/reset-password ─────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ success: false, error: "Min 6 characters" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (user.role === "host") return res.status(403).json({ success: false, error: "Cannot modify host" });

    user.password = password;  // pre-save hook hashes
    await user.save();
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) { next(err); }
};

// ── DELETE /api/host/users/:id ────────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (user.role === "host") return res.status(403).json({ success: false, error: "Cannot delete host" });

    await User.deleteOne({ _id: user._id });
    if (user.role === "admin") await User.deleteMany({ workspace: user._id });

    res.json({ success: true, message: "User deleted" });
  } catch (err) { next(err); }
};

// ── PATCH /api/host/users/:id/permissions ────────────────────────────────────
const updatePermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    user.permissions = permissions || [];
    await user.save();
    res.json({ success: true, data: safeUser(user) });
  } catch (err) { next(err); }
};

module.exports = {
  seedHost, setupHost, hostLogin,
  getAdmins, createAdmin, getAllUsers,
  toggleActive, resetPassword, deleteUser, updatePermissions,
};
