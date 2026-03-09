const nodemailer = require("nodemailer");

// ── Create Gmail transporter ──────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Verify connection on startup ──────────────────────────────────────────────
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email service error:", error.message);
  } else {
    console.log("✅ Email service ready");
  }
});

// ── Send verification code email ──────────────────────────────────────────────
const sendVerificationEmail = async (toEmail, adminName, code) => {
  const mailOptions = {
    from:    `"${process.env.EMAIL_FROM || "AtelierGold"}" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: "✦ AtelierGold — Your Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;padding:0;background:#0D0B07;font-family:'Helvetica Neue',Arial,sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:#151209;border:1px solid #3A2E15;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#9A7A2E,#C9A84C);padding:32px;text-align:center;">
            <div style="font-size:28px;color:#0D0B07;font-weight:300;letter-spacing:3px;">✦ AtelierGold</div>
            <div style="font-size:12px;color:#0D0B07;opacity:0.7;margin-top:4px;letter-spacing:2px;">JEWELLERY MANAGEMENT</div>
          </div>

          <!-- Body -->
          <div style="padding:40px 36px;">
            <p style="color:#F0E8D5;font-size:16px;margin:0 0 8px;">Hello, <strong>${adminName}</strong></p>
            <p style="color:#8A7A5A;font-size:14px;margin:0 0 32px;line-height:1.6;">
              Your admin account verification code for AtelierGold is:
            </p>

            <!-- Code box -->
            <div style="background:#0D0B07;border:2px solid #C9A84C;border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
              <div style="font-size:48px;font-weight:700;letter-spacing:12px;color:#C9A84C;">${code}</div>
            </div>

            <p style="color:#8A7A5A;font-size:13px;margin:0;line-height:1.7;">
              ⏱ This code expires in <strong style="color:#F0E8D5;">10 minutes.</strong><br/>
              🔒 Do not share this code with anyone.<br/>
              ❌ If you did not request this, please ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#0D0B07;padding:20px 36px;text-align:center;border-top:1px solid #3A2E15;">
            <p style="color:#3A2E15;font-size:12px;margin:0;">© ${new Date().getFullYear()} AtelierGold. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
