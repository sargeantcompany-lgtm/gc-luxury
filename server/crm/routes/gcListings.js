const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../adminAuth');

// GET all listings - public (the marketing site reads this directly).
// Pass ?status=active to filter, as the public site does; the admin UI
// calls this with no filter to see everything including sold/archived.
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM gc_listings';
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    }
    query += ' ORDER BY display_order ASC, created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single listing - public
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM gc_listings WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create listing - admin only
router.post('/', requireAdmin, async (req, res) => {
  const { title, suburb, price_guide, description, photos, status, display_order } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const result = await db.query(
      `INSERT INTO gc_listings (title, suburb, price_guide, description, photos, status, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, suburb || null, price_guide || null, description || null, JSON.stringify(photos || []), status || 'active', display_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update listing - admin only
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, suburb, price_guide, description, photos, status, display_order } = req.body;
  try {
    const result = await db.query(
      `UPDATE gc_listings SET title=$1, suburb=$2, price_guide=$3, description=$4, photos=$5, status=$6, display_order=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, suburb || null, price_guide || null, description || null, JSON.stringify(photos || []), status || 'active', display_order || 0, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE listing - admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM gc_listings WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
