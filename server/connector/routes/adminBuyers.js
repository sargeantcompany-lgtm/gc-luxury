const express = require("express");
const router = express.Router();
const { query } = require("../../db");
const { requireAdmin } = require("../adminAuth");

router.use(requireAdmin);

async function getBuyersWithSummary() {
  const result = await query(`
    SELECT
      b.id, b.name, b.phone, b.email, b.joined_via, b.joined_at,
      br.property_type, br.price_min, br.price_max, br.areas, br.must_haves,
      COALESCE(sl.saved_count, 0) AS saved_count
    FROM buyers b
    LEFT JOIN buyer_briefs br ON br.buyer_id = b.id
    LEFT JOIN (
      SELECT buyer_id, COUNT(*) AS saved_count FROM saved_listings GROUP BY buyer_id
    ) sl ON sl.buyer_id = b.id
    ORDER BY b.joined_at DESC
  `);
  return result.rows;
}

router.get("/buyers", async (req, res) => {
  try {
    const buyers = await getBuyersWithSummary();
    res.json({ buyers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/buyers/export.csv", async (req, res) => {
  try {
    const buyers = await getBuyersWithSummary();
    const headers = ["name", "phone", "email", "joined_via", "joined_at", "property_type", "price_min", "price_max", "areas", "must_haves", "saved_count"];
    const rows = [headers.join(",")];
    for (const b of buyers) {
      rows.push(headers.map((h) => {
        const val = b[h] === null || b[h] === undefined ? "" : String(b[h]);
        return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(","));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="connector-buyers.csv"');
    res.send(rows.join("\n"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/buyers/:id", async (req, res) => {
  try {
    await query("DELETE FROM buyers WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SINGLE BUYER DETAIL (brief + top five + off-market matches) ─
router.get("/buyers/:id", async (req, res) => {
  try {
    const buyerResult = await query("SELECT id, name, phone, email, joined_via, joined_at FROM buyers WHERE id = $1", [req.params.id]);
    if (!buyerResult.rows.length) return res.status(404).json({ error: "Buyer not found" });

    const briefResult = await query("SELECT * FROM buyer_briefs WHERE buyer_id = $1", [req.params.id]);

    const topFiveResult = await query(
      `SELECT l.*, t.id AS pin_id, t.pinned_at
       FROM top_five t JOIN listings l ON l.id = t.listing_id
       WHERE t.buyer_id = $1 ORDER BY t.pinned_at DESC`,
      [req.params.id]
    );

    const matchesResult = await query(
      `SELECT l.*, cm.id AS match_id, cm.note, cm.assigned_at
       FROM connector_matches cm
       JOIN listings l ON l.id = cm.listing_id
       WHERE cm.buyer_id = $1
       ORDER BY cm.assigned_at DESC`,
      [req.params.id]
    );

    res.json({
      buyer: buyerResult.rows[0],
      brief: briefResult.rows[0] || null,
      topFive: topFiveResult.rows,
      matches: matchesResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POOL LISTINGS NOT YET IN THIS BUYER'S OFF-MARKET LIST ─────
router.get("/buyers/:id/available-listings", async (req, res) => {
  try {
    const result = await query(
      `SELECT l.* FROM listings l
       WHERE NOT EXISTS (
         SELECT 1 FROM connector_matches cm WHERE cm.listing_id = l.id AND cm.buyer_id = $1
       )
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ASSIGN / UNASSIGN A POOL LISTING TO THIS BUYER'S OFF-MARKET ─
router.post("/buyers/:id/assign/:listingId", async (req, res) => {
  try {
    const result = await query(
      `INSERT INTO connector_matches (listing_id, buyer_id, note) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.listingId, req.params.id, req.body?.note || null]
    );
    res.status(201).json({ match: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/buyers/:id/assign/:listingId", async (req, res) => {
  try {
    await query(
      "DELETE FROM connector_matches WHERE buyer_id = $1 AND listing_id = $2",
      [req.params.id, req.params.listingId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POOL LISTINGS NOT YET IN THIS BUYER'S TOP FIVE ────────────
router.get("/buyers/:id/available-for-top-five", async (req, res) => {
  try {
    const result = await query(
      `SELECT l.* FROM listings l
       WHERE NOT EXISTS (
         SELECT 1 FROM top_five t WHERE t.listing_id = l.id AND t.buyer_id = $1
       )
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    res.json({ listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PIN / UNPIN A POOL LISTING TO THIS BUYER'S TOP FIVE ───────
router.post("/buyers/:id/top-five/:listingId", async (req, res) => {
  try {
    const count = await query("SELECT COUNT(*) AS total FROM top_five WHERE buyer_id = $1", [req.params.id]);
    if (parseInt(count.rows[0].total) >= 5) {
      return res.status(400).json({ error: "This buyer's Top 5 is already full — unpin something first" });
    }
    const result = await query(
      `INSERT INTO top_five (buyer_id, listing_id, pinned_by) VALUES ($1, $2, $3)
       ON CONFLICT (buyer_id, listing_id) DO NOTHING RETURNING *`,
      [req.params.id, req.params.listingId, req.body?.admin || "Admin"]
    );
    res.status(201).json({ pin: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/buyers/:id/top-five/:listingId", async (req, res) => {
  try {
    await query(
      "DELETE FROM top_five WHERE buyer_id = $1 AND listing_id = $2",
      [req.params.id, req.params.listingId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AGENT DIRECTORY MANAGEMENT ────────────────────────────────
router.get("/agents", async (req, res) => {
  try {
    const result = await query("SELECT * FROM agent_contacts ORDER BY name ASC");
    res.json({ agents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/agents", async (req, res) => {
  const { name, agency, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const result = await query(
      "INSERT INTO agent_contacts (name, agency, phone, email) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, agency || null, phone || null, email || null]
    );
    res.status(201).json({ agent: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/agents/:id", async (req, res) => {
  try {
    await query("DELETE FROM agent_contacts WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
