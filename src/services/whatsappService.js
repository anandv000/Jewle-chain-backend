const twilio = require("twilio");

/**
 * sendReceiptWhatsApp(entry, pdfUrl)
 * Sends the gold receipt details via WhatsApp using Twilio.
 *
 * Requirements in .env:
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   ← Twilio sandbox number
 *
 * Customer's phone must be in format: +91XXXXXXXXXX
 */
const sendReceiptWhatsApp = async (entry) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.warn("⚠  Twilio credentials not set. Skipping WhatsApp.");
    return { sent: false, reason: "Twilio not configured" };
  }

  // Format phone — ensure it starts with +91
  let phone = (entry.customerPhone || "").replace(/\D/g, "");
  if (phone.length === 10) phone = `+91${phone}`;
  else if (!phone.startsWith("+")) phone = `+${phone}`;

  if (phone.length < 12) {
    return { sent: false, reason: "Invalid phone number" };
  }

  const dateStr = new Date(entry.date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });

  // Build text message with receipt details
  const itemLines = (entry.items || []).map((it, i) =>
    `  ${i + 1}. ${it.item || "—"} | ${it.quality || ""} | Wt: ${it.weight || 0}g | Pure: ${it.pureWt || 0}g`
  ).join("\n");

  const message = `✦ *ATELIER GOLD — Party Receive Gold*
  
Receipt No : ${entry.receiptNo}
Date       : ${dateStr}
Party      : ${entry.customerName}

*Items:*
${itemLines}

*Total Weight : ${(entry.totalWeight || 0).toFixed(3)}g*
*Total Pure Wt: ${(entry.totalPureWt || 0).toFixed(3)}g*

${entry.remark ? `Remark: ${entry.remark}` : ""}

NOTE: Weight for metals are in grams & gems are in carats.
— ATELIER GOLD`;

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({
      from: TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      to:   `whatsapp:${phone}`,
      body: message,
    });
    console.log(`✅ WhatsApp sent to ${phone} — SID: ${msg.sid}`);
    return { sent: true, sid: msg.sid };
  } catch (err) {
    console.error("WhatsApp error:", err.message);
    return { sent: false, reason: err.message };
  }
};

module.exports = { sendReceiptWhatsApp };
