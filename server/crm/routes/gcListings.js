const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../adminAuth');

const LISTING_TYPES = ['listing', 'off_market'];

function listingType(value) {
  return LISTING_TYPES.includes(value) ? value : 'listing';
}

// GET all listings - public (the marketing site reads this directly).
// Pass ?status=active and/or ?type=listing|off_market to filter, as the public
// site does; the admin UI calls this with no filter to see everything.
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = 'SELECT * FROM gc_listings';
    const params = [];
    const where = [];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      where.push(`listing_type = $${params.length}`);
    }
    if (where.length) query += ` WHERE ${where.join(' AND ')}`;
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
  const { title, suburb, price_guide, description, photos, video_url, status, display_order, listing_type } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const result = await db.query(
      `INSERT INTO gc_listings (title, suburb, price_guide, description, photos, video_url, status, display_order, listing_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, suburb || null, price_guide || null, description || null, JSON.stringify(photos || []), video_url || null, status || 'active', display_order || 0, listingType(listing_type)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update listing - admin only
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, suburb, price_guide, description, photos, video_url, status, display_order, listing_type } = req.body;
  try {
    const result = await db.query(
      `UPDATE gc_listings SET title=$1, suburb=$2, price_guide=$3, description=$4, photos=$5, video_url=$6, status=$7, display_order=$8, listing_type=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [title, suburb || null, price_guide || null, description || null, JSON.stringify(photos || []), video_url || null, status || 'active', display_order || 0, listingType(listing_type), req.params.id]
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
