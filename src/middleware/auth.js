const jwt  = require("jsonwebtoken");
const User = require("../models/User");

// ── Verify JWT + attach req.user ──────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return res.status(401).json({ success:false, error:"Not authenticated" });

    const token = auth.split(" ")[1];
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id).select("-password -otp -otpExpiry");
    if (!user)         return res.status(401).json({ success:false, error:"User not found" });
    if (!user.isActive)return res.status(403).json({ success:false, error:"Account deactivated. Contact your administrator." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success:false, error:"Invalid or expired token" });
  }
};

// ── Role guard factory ────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ success:false, error:`Access denied. Requires role: ${roles.join(" or ")}` });
  next();
};

module.exports = { protect, requireRole };
