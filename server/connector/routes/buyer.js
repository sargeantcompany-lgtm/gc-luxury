const express = require("express");
const router = express.Router();
const { query } = require("../../db");
const { createSession, setSessionCookie, clearSessionCookie, destroySession, requireBuyer, parseCookies, SESSION_COOKIE } = require("../auth");

// ─── JOIN ──────────────────────────────────────────────────────
router.post("/join", async (req, res) => {
  const { name, phone, email, src } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    const existing = await query("SELECT * FROM buyers WHERE email = $1", [email]);
    let buyer = existing.rows[0];

    if (!buyer) {
      const result = await query(
        `INSERT INTO buyers (name, phone, email, joined_via) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, phone || null, email, src || null]
      );
      buyer = result.rows[0];
    }

    const { token, expiresAt } = await createSession(buyer.id);
    setSessionCookie(res, token, expiresAt);
    res.status(201).json({ buyer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ME ────────────────────────────────────────────────────────
router.get("/me", requireBuyer, (req, res) => {
  res.json({ buyer: req.buyer });
});

// ─── LOGOUT ────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  try {
    await destroySession(cookies[SESSION_COOKIE]);
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BRIEF ─────────────────────────────────────────────────────
router.get("/brief", requireBuyer, async (req, res) => {
  try {
    const result = await query("SELECT * FROM buyer_briefs WHERE buyer_id = $1", [req.buyer.id]);
    res.json({ brief: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/brief", requireBuyer, async (req, res) => {
  const { propertyType, priceMin, priceMax, areas, mustHaves } = req.body;
  try {
    const result = await query(
      `INSERT INTO buyer_briefs (buyer_id, property_type, price_min, price_max, areas, must_haves, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (buyer_id) DO UPDATE SET
         property_type = $2, price_min = $3, price_max = $4, areas = $5, must_haves = $6, updated_at = NOW()
       RETURNING *`,
      [req.buyer.id, propertyType || null, priceMin || null, priceMax || null, areas || null, mustHaves || null]
    );
    res.json({ brief: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TOP FIVE ──────────────────────────────────────────────────
router.get("/top-five", requireBuyer, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.* FROM top_five t JOIN listings l ON l.id = t.listing_id ORDER BY t.pinned_at DESC`
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OFF-MARKET BROWSE ─────────────────────────────────────────
router.get("/off-market", requireBuyer, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM listings WHERE type = 'off_market' ORDER BY created_at DESC`
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONNECTOR MATCHES ASSIGNED TO THIS BUYER ─────────────────
router.get("/matches", requireBuyer, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*, cm.note, cm.assigned_at FROM connector_matches cm
       JOIN listings l ON l.id = cm.listing_id
       WHERE cm.buyer_id = $1 ORDER BY cm.assigned_at DESC`,
      [req.buyer.id]
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SAVED LISTINGS ────────────────────────────────────────────
router.get("/saved", requireBuyer, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*, s.saved_at FROM saved_listings s
       JOIN listings l ON l.id = s.listing_id
       WHERE s.buyer_id = $1 ORDER BY s.saved_at DESC`,
      [req.buyer.id]
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/save/:listingId", requireBuyer, async (req, res) => {
  try {
    await query(
      `INSERT INTO saved_listings (buyer_id, listing_id) VALUES ($1, $2)
       ON CONFLICT (buyer_id, listing_id) DO NOTHING`,
      [req.buyer.id, req.params.listingId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/save/:listingId", requireBuyer, async (req, res) => {
  try {
    await query(
      "DELETE FROM saved_listings WHERE buyer_id = $1 AND listing_id = $2",
      [req.buyer.id, req.params.listingId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VALUATION REQUESTS ────────────────────────────────────────
router.get("/valuations", requireBuyer, async (req, res) => {
  try {
    const result = await query(
      `SELECT v.*, l.address AS listing_address FROM valuation_requests v
       JOIN listings l ON l.id = v.listing_id
       WHERE v.buyer_id = $1 ORDER BY v.requested_at DESC`,
      [req.buyer.id]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/valuations/:listingId", requireBuyer, async (req, res) => {
  try {
    const existing = await query(
      `SELECT * FROM valuation_requests WHERE buyer_id = $1 AND listing_id = $2 AND status = 'requested'`,
      [req.buyer.id, req.params.listingId]
    );
    if (existing.rows.length) {
      return res.status(200).json({ request: existing.rows[0], alreadyRequested: true });
    }
    const result = await query(
      `INSERT INTO valuation_requests (buyer_id, listing_id) VALUES ($1, $2) RETURNING *`,
      [req.buyer.id, req.params.listingId]
    );
    res.status(201).json({ request: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AGENT DIRECTORY ───────────────────────────────────────────
router.get("/agents", requireBuyer, async (req, res) => {
  try {
    const result = await query("SELECT * FROM agent_contacts ORDER BY name ASC");
    res.json({ agents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
