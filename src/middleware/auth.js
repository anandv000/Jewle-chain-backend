const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const HOST_EMAIL = "anandkautilyam@gmail.com";

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return res.status(401).json({ success:false, error:"Not authenticated" });

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, role, email } = decoded;

    // ── Primary lookup: by ID ─────────────────────────────────────────────
    let user = await User.findById(id).select("-password -otp -otpExpiry");

    // ── Fallback 1: by email in token (handles Vercel serverless DB issues)
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() })
                       .select("-password -otp -otpExpiry");
    }

    // ── Fallback 2: host role → find by hardcoded email ───────────────────
    if (!user && role === "host") {
      user = await User.findOne({ email: HOST_EMAIL.toLowerCase() })
                       .select("-password -otp -otpExpiry");
    }

    if (!user)
      return res.status(401).json({ success:false, error:"User not found. Please log in again." });

    if (!user.isActive)
      return res.status(403).json({ success:false, error:"Account deactivated. Contact your administrator." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success:false, error:"Invalid or expired token. Please log in again." });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ success:false, error:`Access denied. Requires role: ${roles.join(" or ")}` });
  next();
};

module.exports = { protect, requireRole };
