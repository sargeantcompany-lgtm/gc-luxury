const express = require('express');
const router = express.Router();
const db = require('../../db');

// GET all brands
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM brands ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single brand
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM brands WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create brand
router.post('/', async (req, res) => {
  const { name, color, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Brand name is required' });
  try {
    const result = await db.query(
      'INSERT INTO brands (name, color, logo_url) VALUES ($1, $2, $3) RETURNING *',
      [name, color || '#2563eb', logo_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Brand name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update brand
router.put('/:id', async (req, res) => {
  const { name, color, logo_url } = req.body;
  try {
    const result = await db.query(
      'UPDATE brands SET name=$1, color=$2, logo_url=$3 WHERE id=$4 RETURNING *',
      [name, color, logo_url, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Brand name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE brand
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM brands WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET brand stats
router.get('/:id/stats', async (req, res) => {
  try {
    const [contacts, campaigns] = await Promise.all([
      db.query('SELECT COUNT(*) as total, pipeline_stage FROM contacts WHERE brand_id=$1 GROUP BY pipeline_stage', [req.params.id]),
      db.query('SELECT COUNT(*) as total, status FROM campaigns WHERE brand_id=$1 GROUP BY status', [req.params.id]),
    ]);
    res.json({ contacts: contacts.rows, campaigns: campaigns.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
