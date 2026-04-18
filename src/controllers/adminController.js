const User = require("../models/User");

const TEAM_ROLES = ["sub-admin", "hr", "employee"];

const safeUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone,
  role: u.role, permissions: u.permissions,
  isActive: u.isActive, workspace: u.workspace, createdAt: u.createdAt,
});

// ── GET /api/admin/team — get all users in this admin's workspace ─────────────
const getTeam = async (req, res, next) => {
  try {
    const adminId = req.user._id;
    const members = await User.find({ workspace: adminId }).sort({ createdAt:-1 });
    res.json({ success:true, data: members.map(safeUser) });
  } catch (err) { next(err); }
};

// ── POST /api/admin/team — create a team member ───────────────────────────────
const createMember = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ success:false, error:"Name, email, password, role required" });

    if (!TEAM_ROLES.includes(role))
      return res.status(400).json({ success:false, error:`Role must be one of: ${TEAM_ROLES.join(", ")}` });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ success:false, error:"Email already registered" });

    const user = await User.create({
      name, email, phone: phone||"", password, role,
      permissions: permissions || ["dashboard"],
      isActive:   true,
      isVerified: true,
      workspace:  req.user._id,
      createdBy:  req.user._id,
    });
    res.status(201).json({ success:true, data: safeUser(user) });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/team/:id — update name, phone, role, permissions ───────────
const updateMember = async (req, res, next) => {
  try {
    const { name, phone, role, permissions, isActive } = req.body;
    const user = await User.findOne({ _id: req.params.id, workspace: req.user._id });
    if (!user) return res.status(404).json({ success:false, error:"Team member not found" });

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role && TEAM_ROLES.includes(role)) user.role = role;
    if (permissions) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json({ success:true, data: safeUser(user) });
  } catch (err) { next(err); }
};

// ── PATCH /api/admin/team/:id/reset-password ──────────────────────────────────
const resetMemberPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ success:false, error:"Min 6 characters" });

    const user = await User.findOne({ _id: req.params.id, workspace: req.user._id });
    if (!user) return res.status(404).json({ success:false, error:"Team member not found" });

    user.password = password;
    await user.save();
    res.json({ success:true, message:"Password reset successfully" });
  } catch (err) { next(err); }
};

// ── DELETE /api/admin/team/:id ────────────────────────────────────────────────
const deleteMember = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, workspace: req.user._id });
    if (!user) return res.status(404).json({ success:false, error:"Team member not found" });
    await User.deleteOne({ _id: user._id });
    res.json({ success:true, message:"Member removed" });
  } catch (err) { next(err); }
};

// ── GET /api/admin/permissions-list ──────────────────────────────────────────
const getPermissionsList = async (req, res) => {
  res.json({ success:true, data: User.schema.statics.ALL_PERMISSIONS || [] });
};

module.exports = { getTeam, createMember, updateMember, resetMemberPassword, deleteMember, getPermissionsList };
