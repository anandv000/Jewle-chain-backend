const nodemailer = require("nodemailer");

// ── Transporter (Gmail) ───────────────────────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,   // atliergolds@gmail.com
      pass: process.env.EMAIL_PASS,   // Gmail app password
    },
  });

// ── Send OTP to registering user ──────────────────────────────────────────────
const sendOTPEmail = async (email, otp, name) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"AtelierGold" <${process.env.EMAIL_USER}>`,
    to:   email,
    subject: "Your AtelierGold OTP Code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0D0B07;color:#F0E8D5;border-radius:12px;">
        <div style="font-size:22px;color:#C9A84C;margin-bottom:8px;">✦ AtelierGold</div>
        <h2 style="color:#F0E8D5;margin:0 0 24px">Email Verification</h2>
        <p style="color:#8A7A5A;">Hello <strong style="color:#F0E8D5">${name}</strong>,</p>
        <p style="color:#8A7A5A;">Your OTP code to complete registration:</p>
        <div style="background:#1C1710;border:1px solid #3A2E15;border-radius:10px;padding:24px;text-align:center;margin:24px 0;">
          <div style="font-size:38px;font-weight:bold;letter-spacing:12px;color:#C9A84C;">${otp}</div>
          <div style="color:#8A7A5A;font-size:12px;margin-top:8px;">Expires in 10 minutes</div>
        </div>
        <p style="color:#8A7A5A;font-size:12px;">If you did not request this, ignore this email.</p>
        <div style="margin-top:32px;border-top:1px solid #3A2E15;padding-top:16px;font-size:11px;color:#8A7A5A;">— AtelierGold Jewellery Management</div>
      </div>
    `,
  });
};

// ── Notify atliergolds@gmail.com when a new user registers ───────────────────
const sendAdminNewUserNotification = async ({ name, email, phone }) => {
  try {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || "atliergolds@gmail.com";
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"AtelierGold System" <${process.env.EMAIL_USER}>`,
      to:      adminEmail,
      subject: `🆕 New User Registered — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0D0B07;color:#F0E8D5;border-radius:12px;">
          <div style="font-size:22px;color:#C9A84C;margin-bottom:8px;">✦ AtelierGold</div>
          <h2 style="color:#F0E8D5;margin:0 0 20px">New User Registered</h2>
          <div style="background:#1C1710;border:1px solid #3A2E15;border-radius:10px;padding:20px;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#8A7A5A;font-size:13px;width:100px;">Name</td>
                <td style="padding:8px 0;color:#F0E8D5;font-size:14px;font-weight:bold;">${name}</td>
              </tr>
              <tr style="border-top:1px solid #3A2E15;">
                <td style="padding:8px 0;color:#8A7A5A;font-size:13px;">Email</td>
                <td style="padding:8px 0;color:#C9A84C;font-size:14px;">${email}</td>
              </tr>
              <tr style="border-top:1px solid #3A2E15;">
                <td style="padding:8px 0;color:#8A7A5A;font-size:13px;">Phone</td>
                <td style="padding:8px 0;color:#F0E8D5;font-size:14px;">${phone || "—"}</td>
              </tr>
              <tr style="border-top:1px solid #3A2E15;">
                <td style="padding:8px 0;color:#8A7A5A;font-size:13px;">Time</td>
                <td style="padding:8px 0;color:#F0E8D5;font-size:13px;">${new Date().toLocaleString("en-IN", { timeZone:"Asia/Kolkata" })} IST</td>
              </tr>
            </table>
          </div>
          <p style="color:#8A7A5A;font-size:12px;">This user has received an OTP and is pending email verification.</p>
          <div style="margin-top:24px;border-top:1px solid #3A2E15;padding-top:14px;font-size:11px;color:#8A7A5A;">— AtelierGold Auto Notification</div>
        </div>
      `,
    });
    console.log(`📧 Admin notified of new user: ${email}`);
  } catch (err) {
    // Don't block registration if notification fails
    console.warn("Admin notification email failed:", err.message);
  }
};

module.exports = { sendOTPEmail, sendAdminNewUserNotification };
