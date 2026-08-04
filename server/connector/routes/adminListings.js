const express = require("express");
const router = express.Router();
const { query } = require("../../db");
const { requireAdmin } = require("../adminAuth");
const { fetchListingPreview } = require("../ogFetch");

router.use(requireAdmin);

// ─── LIST all listings (with pin + assignment info) ───────────
router.get("/listings", async (req, res) => {
  try {
    const result = await query(`
      SELECT l.*,
        (t.id IS NOT NULL) AS is_pinned,
        cm.buyer_id AS connector_match_buyer_id,
        b.name AS connector_match_buyer_name,
        cm.note AS connector_match_note
      FROM listings l
      LEFT JOIN top_five t ON t.listing_id = l.id
      LEFT JOIN connector_matches cm ON cm.listing_id = l.id
      LEFT JOIN buyers b ON b.id = cm.buyer_id
      ORDER BY l.created_at DESC
    `);
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADD off-market listing (manual entry) ─────────────────────
router.post("/listings/off-market", async (req, res) => {
  const { address, price_guide, description, photos } = req.body;
  if (!address) return res.status(400).json({ error: "address is required" });
  try {
    const result = await query(
      `INSERT INTO listings (type, address, price_guide, description, photos, added_by_admin)
       VALUES ('off_market', $1, $2, $3, $4, $5) RETURNING *`,
      [address, price_guide || null, description || null, JSON.stringify(photos || []), req.body.admin || "Admin"]
    );
    res.status(201).json({ listing: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FETCH preview from a REA/Domain URL (no DB write) ─────────
router.post("/listings/fetch-preview", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const preview = await fetchListingPreview(url);
    res.json({ preview });
  } catch (err) {
    res.status(200).json({
      preview: { address: null, price_guide: null, description: null, photos: [], fetched_ok: false },
      warning: `Auto-fill failed (${err.message}) — enter details manually.`,
    });
  }
});

// ─── CREATE connector match + assign to buyer ───────────────────
router.post("/listings/connector-match", async (req, res) => {
  const { address, price_guide, description, photos, source_url, buyerId, note } = req.body;
  if (!address || !buyerId) {
    return res.status(400).json({ error: "address and buyerId are required" });
  }
  try {
    const listingResult = await query(
      `INSERT INTO listings (type, source_url, address, price_guide, description, photos, added_by_admin)
       VALUES ('connector_match', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [source_url || null, address, price_guide || null, description || null, JSON.stringify(photos || []), req.body.admin || "Admin"]
    );
    const listing = listingResult.rows[0];

    await query(
      `INSERT INTO connector_matches (listing_id, buyer_id, note) VALUES ($1, $2, $3)`,
      [listing.id, buyerId, note || null]
    );

    // Notification: no SMTP configured yet, so this is logged server-side for now.
    console.log(`[Connector] Match assigned to buyer ${buyerId}: listing ${listing.id} (${address})`);

    res.status(201).json({ listing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE listing ──────────────────────────────────────────
router.put("/listings/:id", async (req, res) => {
  const { address, price_guide, description, photos } = req.body;
  try {
    const result = await query(
      `UPDATE listings SET address=$1, price_guide=$2, description=$3, photos=$4 WHERE id=$5 RETURNING *`,
      [address, price_guide || null, description || null, JSON.stringify(photos || []), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Listing not found" });
    res.json({ listing: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE listing ──────────────────────────────────────────
router.delete("/listings/:id", async (req, res) => {
  try {
    await query("DELETE FROM listings WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
