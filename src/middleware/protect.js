const jwt   = require("jsonwebtoken");
const Admin = require("../models/Admin");

const protect = async (req, res, next) => {
  let token;

  // Check Authorization header: "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: "Not authorized. Please login." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select("-password");

    if (!req.admin) {
      return res.status(401).json({ success: false, error: "Admin not found. Please login again." });
    }
    if (!req.admin.isVerified) {
      return res.status(401).json({ success: false, error: "Email not verified. Please verify your account." });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Token invalid or expired. Please login again." });
  }
};

module.exports = protect;
