const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email, permissions: user.permissions },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const safeUser = (u) => ({
  _id:         u._id,
  name:        u.name,
  email:       u.email,
  phone:       u.phone,
  role:        u.role,
  permissions: u.permissions,
  isActive:    u.isActive,
  workspace:   u.workspace,
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success:false, error:"Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res.status(401).json({ success:false, error:"Invalid email or password" });

    if (!user.isActive)
      return res.status(403).json({ success:false, error:"Account has been deactivated. Contact your administrator." });

    const ok = await user.matchPassword(password);
    if (!ok)
      return res.status(401).json({ success:false, error:"Invalid email or password" });

    res.status(200).json({
      success: true,
      data: { ...safeUser(user), token: generateToken(user) },
    });
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = (req, res) => {
  res.status(200).json({ success:true, data: safeUser(req.user) });
};

module.exports = { login, getMe };
