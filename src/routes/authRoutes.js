const express = require("express");
const router  = express.Router();
const { register, verifyOTP, resendOTP, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// POST /api/auth/register    — Step 1: register + send OTP
router.post("/register",   register);

// POST /api/auth/verify-otp  — Step 2: verify OTP → create account
router.post("/verify-otp", verifyOTP);

// POST /api/auth/resend-otp  — Resend OTP if not received
router.post("/resend-otp", resendOTP);

// POST /api/auth/login       — Login with email + password
router.post("/login",      login);

// GET  /api/auth/me          — Get current logged in user (protected)
router.get("/me", protect,  getMe);

module.exports = router;
