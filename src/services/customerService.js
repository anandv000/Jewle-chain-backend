/**
 * customerService.js
 *
 * Shared helper used by BOTH goldEntryController and orderController.
 *
 * syncCustomerTotals re-calculates a customer's balances from scratch:
 *
 *   gold   = gold_deposits  − returnGold   − castingGold(from non-owner-gold orders)
 *   silver = silver_deposits − returnSilver − castingSilver(from non-owner-silver orders)
 *   diamonds/karats = diamond_deposits − returned diamonds
 *
 * This is the ONLY place that writes to customer.gold / customer.silver /
 * customer.diamonds / customer.diamondKarats.  The orderController's casting step
 * must save the order FIRST, then call this function — not modify customer.gold
 * directly — so the calculation is always consistent.
 */

const GoldEntry = require("../models/GoldEntry");
const Order     = require("../models/Order");
const Customer  = require("../models/Customer");

const syncCustomerTotals = async (customerId) => {
  try {
    const [entries, orders] = await Promise.all([
      GoldEntry.find({ customer: customerId }),
      Order.find({ customer: customerId }),
    ]);

    // ── GOLD ──────────────────────────────────────────────────────────────────
    const goldDeposited = entries
      .filter(e => e.entryType === "gold_deposit")
      .reduce((s, e) => s + (e.totalWeight || 0), 0);

    const goldReturned = entries                         // ← BUG 1 FIX
      .filter(e => e.entryType === "return")
      .reduce((s, e) => s + (e.returnGold || 0), 0);

    const goldCast = orders                              // ← BUG 2 FIX
      .filter(o => !o.usesOwnerGold && (o.castingGold || 0) > 0)
      .reduce((s, o) => s + (o.castingGold || 0), 0);

    const gold = parseFloat(Math.max(0, goldDeposited - goldReturned - goldCast).toFixed(3));

    // ── SILVER ────────────────────────────────────────────────────────────────
    const silverDeposited = entries
      .filter(e => e.entryType === "silver_deposit")
      .reduce((s, e) => s + (e.totalWeight || 0), 0);

    const silverReturned = entries
      .filter(e => e.entryType === "return")
      .reduce((s, e) => s + (e.returnSilver || 0), 0);

    const silverCast = orders
      .filter(o => !o.usesOwnerSilver && (o.castingSilver || 0) > 0)
      .reduce((s, o) => s + (o.castingSilver || 0), 0);

    const silver = parseFloat(Math.max(0, silverDeposited - silverReturned - silverCast).toFixed(3));

    // ── DIAMONDS ──────────────────────────────────────────────────────────────
    const diaIn   = entries.filter(e => e.entryType === "diamond_deposit").reduce((s, e) => s + (e.totalDiamondKarats || 0), 0);
    const diaRet  = entries.filter(e => e.entryType === "return").reduce((s, e) => s + (e.returnDiamondKarats || 0), 0);
    const diamondKarats = parseFloat(Math.max(0, diaIn - diaRet).toFixed(4));

    const pcsIn  = entries.filter(e => e.entryType === "diamond_deposit").reduce((s, e) => s + (e.totalDiamondPcs || 0), 0);
    const pcsRet = entries.filter(e => e.entryType === "return").reduce((s, e) => s + (e.returnDiamonds || []).reduce((ps, d) => ps + (d.pcs || 0), 0), 0);
    const diamonds = Math.max(0, pcsIn - pcsRet);

    await Customer.findByIdAndUpdate(customerId, { gold, silver, diamondKarats, diamonds });

    return { gold, silver, diamondKarats, diamonds };
  } catch (err) {
    console.warn("syncCustomerTotals failed:", err.message);
    return null;
  }
};

module.exports = { syncCustomerTotals };
