const PDFDocument = require("pdfkit");
const fs          = require("fs");
const path        = require("path");

/**
 * generateReceipt(entry, outputPath)
 * Generates a gold receipt PDF matching the J.BHAGVAN style.
 * @param {Object} entry   — GoldEntry document (populated)
 * @param {String} outputPath — absolute path to save PDF
 * @returns {Promise<String>} resolved outputPath
 */
const generateReceipt = (entry, outputPath, logoPath = null) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    const W = 595.28;   // A4 width pt
    const m = 30;       // margin

    // ── Fonts ──────────────────────────────────────────────────────────────
    const bold    = "Helvetica-Bold";
    const regular = "Helvetica";

    // ── Outer border ───────────────────────────────────────────────────────
    doc.rect(m, 25, W - m*2, 140).stroke("#000");

    // ── Left: Company Name ─────────────────────────────────────────────────
    doc.font(bold).fontSize(16).text("ATELIER GOLD", m + 10, 35, { width: 180 });
    doc.font(regular).fontSize(10).text("From", m + 10, 58);
    doc.font(bold).fontSize(12).text(entry.customerName.toUpperCase(), m + 10, 73);

    // ── Center: Logo ───────────────────────────────────────────────────────
    const centerX = W / 2;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, centerX - 35, 35, { width: 70, height: 60 });
      doc.font(bold).fontSize(9).text("ATELIER GOLD", centerX - 35, 100, { width: 70, align: "center" });
    } else {
      doc.circle(centerX, 65, 32).stroke("#333");
      doc.font(bold).fontSize(8).text("ATELIER GOLD", centerX - 30, 72, { width: 60, align: "center" });
    }

    // ── Right: Receipt details ─────────────────────────────────────────────
    const rx = W - m - 170;
    doc.font(bold).fontSize(12).text("Party Receive Gold", rx, 35, { width: 170, align: "right" });

    const dateStr = new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");

    doc.font(regular).fontSize(10);
    const pairs = [
      ["NO",              `: ${entry.receiptNo}`],
      ["DATE",            `: ${dateStr}`],
      ["Party Voucher No", `: ${entry.partyVoucherNo || ""}`],
    ];
    pairs.forEach(([label, value], i) => {
      const y = 60 + i * 17;
      doc.font(bold).text(label, rx, y, { continued: false });
      doc.font(regular).text(value, rx + 80, y);
    });

    // ── Table ──────────────────────────────────────────────────────────────
    const tableY   = 170;
    const rowH     = 22;
    const tableW   = W - m * 2;

    // Column widths
    const cols = [
      { key: "sr",          label: "Sr.",         w: 28  },
      { key: "item",        label: "Item",         w: 55  },
      { key: "shape",       label: "Shape",        w: 45  },
      { key: "quality",     label: "Quality",      w: 52  },
      { key: "accessories", label: "Accessories",  w: 65  },
      { key: "size",        label: "Size",         w: 55  },
      { key: "description", label: "Description",  w: 100 },
      { key: "pieces",      label: "Pieces",       w: 38  },
      { key: "weight",      label: "Weight",       w: 42  },
      { key: "pureWt",      label: "Pure Wt",      w: 42  },
    ];
    // Adjust last cols to fill
    const usedW = cols.reduce((s, c) => s + c.w, 0);
    if (usedW !== tableW) cols[cols.length - 1].w += tableW - usedW;

    // Draw header row
    let x = m;
    doc.rect(m, tableY, tableW, rowH).fillAndStroke("#e8e8e8", "#000");
    cols.forEach(col => {
      doc.font(bold).fontSize(8).fillColor("#000").text(col.label, x + 2, tableY + 7, { width: col.w - 4, align: "center" });
      doc.moveTo(x, tableY).lineTo(x, tableY + rowH).stroke("#000");
      x += col.w;
    });
    doc.moveTo(x, tableY).lineTo(x, tableY + rowH).stroke("#000");

    // Draw item rows
    let rowY = tableY + rowH;
    const items = entry.items || [];
    items.forEach((item, idx) => {
      const vals = {
        sr:          String(idx + 1),
        item:        item.item        || "",
        shape:       item.shape       || "",
        quality:     item.quality     || "",
        accessories: item.accessories || "",
        size:        item.size        || "",
        description: item.description || "",
        pieces:      item.pieces   ? String(item.pieces)             : "",
        weight:      item.weight   ? item.weight.toFixed(3)          : "",
        pureWt:      item.pureWt   ? item.pureWt.toFixed(3)         : "",
      };
      doc.rect(m, rowY, tableW, rowH).stroke("#aaa");
      x = m;
      cols.forEach(col => {
        doc.font(regular).fontSize(8).fillColor("#000").text(vals[col.key], x + 2, rowY + 7, { width: col.w - 4, align: "center" });
        doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke("#aaa");
        x += col.w;
      });
      doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke("#aaa");
      rowY += rowH;
    });

    // Total row
    doc.rect(m, rowY, tableW, rowH).stroke("#000");
    x = m;
    cols.forEach((col, i) => {
      let val = "";
      if (col.key === "description") val = "Total";
      if (col.key === "weight")  val = (entry.totalWeight  || 0).toFixed(3);
      if (col.key === "pureWt")  val = (entry.totalPureWt  || 0).toFixed(3);
      doc.font(i === 6 ? bold : regular).fontSize(8).text(val, x + 2, rowY + 7, { width: col.w - 4, align: "center" });
      doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke("#000");
      x += col.w;
    });
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke("#000");
    rowY += rowH;

    // Page number
    doc.font(regular).fontSize(8).text("Page 1 of 1", m + 4, rowY - rowH + 7);

    // ── Grand Total ─────────────────────────────────────────────────────────
    const gtY = rowY + 30;
    doc.rect(m, gtY, tableW, rowH).stroke("#000");
    x = m;
    cols.forEach((col, i) => {
      let val = "";
      if (col.key === "description") val = "Grand Total";
      if (col.key === "weight")  val = (entry.totalWeight || 0).toFixed(3);
      if (col.key === "pureWt")  val = (entry.totalPureWt || 0).toFixed(3);
      doc.font(i === 6 ? bold : regular).fontSize(9).text(val, x + 2, gtY + 7, { width: col.w - 4, align: "center" });
      doc.moveTo(x, gtY).lineTo(x, gtY + rowH).stroke("#000");
      x += col.w;
    });
    doc.moveTo(x, gtY).lineTo(x, gtY + rowH).stroke("#000");

    // Remark
    const remarkY = gtY + rowH + 10;
    doc.font(regular).fontSize(9).text(`Remark : ${entry.remark || ""}`, m, remarkY);

    // Note
    const noteY = remarkY + 25;
    doc.font(regular).fontSize(8)
      .text("NOTE : WEIGHT FOR METALS ARE IN GRAMS & GEMS ARE IN CARAT.", m, noteY, { align: "center", width: tableW })
      .text("All Rights Reserved by ATELIER GOLD for any error or mistake while making data entry.", m, noteY + 12, { align: "center", width: tableW });

    // Signatures
    const sigY = noteY + 45;
    doc.moveTo(m + 20, sigY + 20).lineTo(m + 120, sigY + 20).stroke("#000");
    doc.font(bold).fontSize(10).text("Sign", m + 40, sigY + 24);

    doc.font(bold).fontSize(10).text("FOR ATELIER GOLD", W - m - 160, sigY);
    doc.moveTo(W - m - 140, sigY + 30).lineTo(W - m, sigY + 30).stroke("#000");
    doc.font(bold).fontSize(10).text("For, ATELIER GOLD", W - m - 150, sigY + 34);
    doc.font(regular).fontSize(8).text("PROPRIETOR", W - m - 150, sigY + 47);

    doc.end();
    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
};

module.exports = { generateReceipt };
