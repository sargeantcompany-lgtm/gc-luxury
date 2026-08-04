const express = require("express");
const router = express.Router();
const { query } = require("../../db");
const { requireAdmin } = require("../adminAuth");

router.use(requireAdmin);

router.get("/top-five", async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*, t.pinned_at, t.pinned_by FROM top_five t
       JOIN listings l ON l.id = t.listing_id
       ORDER BY t.pinned_at DESC`
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/top-five/:listingId", async (req, res) => {
  try {
    const count = await query("SELECT COUNT(*) AS total FROM top_five");
    if (parseInt(count.rows[0].total) >= 5) {
      return res.status(400).json({ error: "Top 5 is already full — unpin something first" });
    }
    await query(
      `INSERT INTO top_five (listing_id, pinned_by) VALUES ($1, $2)
       ON CONFLICT (listing_id) DO NOTHING`,
      [req.params.listingId, req.body.admin || "Admin"]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/top-five/:listingId", async (req, res) => {
  try {
    await query("DELETE FROM top_five WHERE listing_id = $1", [req.params.listingId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
