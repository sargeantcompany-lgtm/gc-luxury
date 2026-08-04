const express = require("express");
const router = express.Router();
const { query } = require("../../db");
const { requireAdmin } = require("../adminAuth");
const { fetchListingPreview } = require("../ogFetch");

router.use(requireAdmin);

// ─── LIST all listings in the pool (with assignment counts) ───
router.get("/listings", async (req, res) => {
  try {
    const result = await query(`
      SELECT l.*,
        COALESCE(pins.pin_count, 0) AS pinned_count,
        COALESCE(matches.match_count, 0) AS assigned_count
      FROM listings l
      LEFT JOIN (SELECT listing_id, COUNT(*) AS pin_count FROM top_five GROUP BY listing_id) pins
        ON pins.listing_id = l.id
      LEFT JOIN (SELECT listing_id, COUNT(*) AS match_count FROM connector_matches GROUP BY listing_id) matches
        ON matches.listing_id = l.id
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

// ─── ADD a listing via URL paste (buyerId optional) ─────────────
// With buyerId: added to the pool AND assigned straight to that buyer.
// Without: added to the pool only, to assign later from a buyer's page.
router.post("/listings/connector-match", async (req, res) => {
  const { address, price_guide, description, photos, source_url, buyerId, note } = req.body;
  if (!address) {
    return res.status(400).json({ error: "address is required" });
  }
  try {
    const listingResult = await query(
      `INSERT INTO listings (type, source_url, address, price_guide, description, photos, added_by_admin)
       VALUES ('connector_match', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [source_url || null, address, price_guide || null, description || null, JSON.stringify(photos || []), req.body.admin || "Admin"]
    );
    const listing = listingResult.rows[0];

    if (buyerId) {
      await query(
        `INSERT INTO connector_matches (listing_id, buyer_id, note) VALUES ($1, $2, $3)`,
        [listing.id, buyerId, note || null]
      );
      // Notification: no SMTP configured yet, so this is logged server-side for now.
      console.log(`[Connector] Match assigned to buyer ${buyerId}: listing ${listing.id} (${address})`);
    }

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
