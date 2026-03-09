const jwt              = require("jsonwebtoken");
const User             = require("../models/User");
const { sendOTPEmail, sendAdminNewUserNotification } = require("../utils/emailService");

const generateOTP   = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Multiple different admins CAN register — unique constraint is only on email.
// Same email = resend OTP if unverified, error if already verified.
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing   = await User.findOne({ email: cleanEmail });

    if (existing && existing.isVerified) {
      return res.status(400).json({
        success: false,
        error: "This email is already registered and verified. Please login instead.",
      });
    }

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (existing && !existing.isVerified) {
      // Overwrite unverified record (same person retrying)
      existing.name      = name.trim();
      existing.phone     = phone || "";
      existing.password  = password;
      existing.otp       = otp;
      existing.otpExpiry = otpExpiry;
      await existing.save();
    } else {
      // Brand new email — create user (any number of different admins allowed)
      await User.create({
        name:       name.trim(),
        email:      cleanEmail,
        phone:      phone || "",
        password,
        otp,
        otpExpiry,
        isVerified: false,
        role:       "admin",
      });
    }

    // Send OTP to the registering user
    await sendOTPEmail(cleanEmail, otp, name.trim());

    // Notify atliergolds@gmail.com of the new registration
    await sendAdminNewUserNotification({ name: name.trim(), email: cleanEmail, phone: phone || "" });

    res.status(200).json({
      success: true,
      message: `OTP sent to ${cleanEmail}. Please verify to complete registration.`,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: "Email and OTP are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)               return res.status(404).json({ success: false, error: "User not found. Please register again." });
    if (user.otp !== otp)    return res.status(400).json({ success: false, error: "Invalid OTP. Please try again." });
    if (user.otpExpiry < new Date()) return res.status(400).json({ success: false, error: "OTP expired. Please request a new one." });

    user.isVerified = true;
    user.otp        = null;
    user.otpExpiry  = null;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        phone: user.phone,
        role:  user.role,
        token: generateToken(user._id),
      },
    });
  } catch (err) { next(err); }
};

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)           return res.status(404).json({ success: false, error: "User not found." });
    if (user.isVerified) return res.status(400).json({ success: false, error: "Account already verified. Please login." });

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otp        = otp;
    user.otpExpiry  = otpExpiry;
    await user.save();
    await sendOTPEmail(email, otp, user.name);

    res.status(200).json({ success: true, message: `New OTP sent to ${email}` });
  } catch (err) { next(err); }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ success: false, error: "Invalid email or password" });

    if (!user.isVerified) {
      return res.status(401).json({ success: false, error: "Account not verified. Please check your email for OTP." });
    }

    const ok = await user.matchPassword(password);
    if (!ok) return res.status(401).json({ success: false, error: "Invalid email or password" });

    res.status(200).json({
      success: true,
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        phone: user.phone,
        role:  user.role,
        token: generateToken(user._id),
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = (req, res) => {
  const u = req.user;
  res.status(200).json({ success: true, data: { _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role } });
};

module.exports = { register, verifyOTP, resendOTP, login, getMe };
