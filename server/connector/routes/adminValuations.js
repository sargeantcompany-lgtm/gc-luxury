const express = require("express");
const router = express.Router();
const { query } = require("../../db");
const { requireAdmin } = require("../adminAuth");

router.use(requireAdmin);

router.get("/valuations", async (req, res) => {
  try {
    const result = await query(`
      SELECT v.*, b.name AS buyer_name, b.email AS buyer_email, l.address AS listing_address
      FROM valuation_requests v
      JOIN buyers b ON b.id = v.buyer_id
      JOIN listings l ON l.id = v.listing_id
      ORDER BY (v.status = 'requested') DESC, v.requested_at DESC
    `);
    res.json({ requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/valuations/:id/fulfil", async (req, res) => {
  const { reportUrl } = req.body;
  if (!reportUrl) return res.status(400).json({ error: "reportUrl is required" });
  try {
    const result = await query(
      `UPDATE valuation_requests SET status='fulfilled', report_url=$1, fulfilled_at=NOW()
       WHERE id=$2 RETURNING *`,
      [reportUrl, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Request not found" });

    // Notification: no SMTP configured yet, so this is logged server-side for now.
    console.log(`[Connector] Valuation fulfilled for request ${req.params.id}`);

    res.json({ request: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
