const express = require('express');
const router = express.Router();
const db = require('../../db');

// GET all templates
router.get('/', async (req, res) => {
  try {
    const { brand_id, type } = req.query;
    let query = `
      SELECT t.*, b.name as brand_name, b.color as brand_color
      FROM templates t
      LEFT JOIN brands b ON t.brand_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (brand_id) { params.push(brand_id); query += ` AND t.brand_id = $${params.length}`; }
    if (type) { params.push(type); query += ` AND t.type = $${params.length}`; }
    query += ' ORDER BY t.type ASC, t.name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single template
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT t.*, b.name as brand_name FROM templates t LEFT JOIN brands b ON t.brand_id = b.id WHERE t.id=$1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create template
router.post('/', async (req, res) => {
  const { brand_id, name, type, subject, body } = req.body;
  if (!name || !type || !body) return res.status(400).json({ error: 'name, type and body are required' });
  if (!['email', 'sms'].includes(type)) return res.status(400).json({ error: 'type must be email or sms' });
  try {
    const result = await db.query(
      'INSERT INTO templates (brand_id, name, type, subject, body) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [brand_id || null, name, type, subject || null, body]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update template
router.put('/:id', async (req, res) => {
  const { brand_id, name, type, subject, body } = req.body;
  try {
    const result = await db.query(
      `UPDATE templates SET brand_id=$1, name=$2, type=$3, subject=$4, body=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [brand_id || null, name, type, subject || null, body, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE template
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM templates WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
