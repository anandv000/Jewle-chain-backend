const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User   = require("../models/User");

const HOST_EMAIL = "anandkautilyam@gmail.com";
const HOST_PASS  = "Anshu@0711";

// ── Seed: auto-create host on startup if not exists ──────────────────────────
const seedHost = async () => {
  try {
    const exists = await User.findOne({ role:"host" });
    if (!exists) {
      await User.create({
        name:        "Atelier Gold Host",
        email:       HOST_EMAIL,
        phone:       "",
        password:    HOST_PASS,
        role:        "host",
        isActive:    true,
        isVerified:  true,
        permissions: User.schema.statics.ALL_PERMISSIONS || [],
      });
      console.log("✦ Host user seeded:", HOST_EMAIL);
    }
  } catch (err) { console.warn("Host seed failed:", err.message); }
};

const safeUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone,
  role: u.role, permissions: u.permissions,
  isActive: u.isActive, isVerified: u.isVerified,
  workspace: u.workspace, createdBy: u.createdBy,
  createdAt: u.createdAt,
});

// ── POST /api/host/login ──────────────────────────────────────────────────────
const hostLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim(), role:"host" });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success:false, error:"Invalid host credentials" });

    const token = jwt.sign({ id:user._id, role:"host" }, process.env.JWT_SECRET, { expiresIn:"7d" });
    res.json({ success:true, data:{ ...safeUser(user), token } });
  } catch (err) { next(err); }
};

// ── GET /api/host/admins ──────────────────────────────────────────────────────
const getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role:"admin" }).sort({ createdAt:-1 });
    res.json({ success:true, data: admins.map(safeUser) });
  } catch (err) { next(err); }
};

// ── POST /api/host/admins — create a new admin account ───────────────────────
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success:false, error:"Name, email, password required" });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(400).json({ success:false, error:"Email already registered" });

    const user = await User.create({
      name, email, phone: phone||"", password,
      role: "admin",
      isActive: true, isVerified: true,
      createdBy: req.user._id,
      permissions: User.schema.statics.ALL_PERMISSIONS || [],
    });
    res.status(201).json({ success:true, data: safeUser(user) });
  } catch (err) { next(err); }
};

// ── GET /api/host/all-users — all users except host ──────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role:{ $ne:"host" } }).sort({ createdAt:-1 });
    res.json({ success:true, data: users.map(safeUser) });
  } catch (err) { next(err); }
};

// ── PATCH /api/host/users/:id/toggle-active ──────────────────────────────────
const toggleActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, error:"User not found" });
    if (user.role === "host") return res.status(403).json({ success:false, error:"Cannot modify host" });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success:true, data: safeUser(user) });
  } catch (err) { next(err); }
};

// ── PATCH /api/host/users/:id/reset-password ─────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ success:false, error:"Password must be at least 6 characters" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, error:"User not found" });
    if (user.role === "host") return res.status(403).json({ success:false, error:"Cannot modify host" });

    user.password = password;
    await user.save();
    res.json({ success:true, message:"Password reset successfully" });
  } catch (err) { next(err); }
};

// ── DELETE /api/host/users/:id ────────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, error:"User not found" });
    if (user.role === "host") return res.status(403).json({ success:false, error:"Cannot delete host" });
    await User.deleteOne({ _id: user._id });
    // Remove all sub-users of this admin if deleting admin
    if (user.role === "admin") {
      await User.deleteMany({ workspace: user._id });
    }
    res.json({ success:true, message:"User deleted" });
  } catch (err) { next(err); }
};

// ── PATCH /api/host/users/:id/permissions ─────────────────────────────────────
const updatePermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, error:"User not found" });
    user.permissions = permissions || [];
    await user.save();
    res.json({ success:true, data: safeUser(user) });
  } catch (err) { next(err); }
};

module.exports = { seedHost, hostLogin, getAdmins, createAdmin, getAllUsers, toggleActive, resetPassword, deleteUser, updatePermissions };
