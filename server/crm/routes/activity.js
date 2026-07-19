const express = require('express');
const router = express.Router();
const db = require('../../db');

// GET activity log
router.get('/', async (req, res) => {
  try {
    const { brand_id, contact_id, campaign_id, type, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT
        a.*,
        b.name as brand_name,
        b.color as brand_color,
        c.first_name || ' ' || c.last_name as contact_name,
        c.email as contact_email,
        camp.name as campaign_name
      FROM activity_log a
      LEFT JOIN brands b ON a.brand_id = b.id
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN campaigns camp ON a.campaign_id = camp.id
      WHERE 1=1
    `;
    const params = [];
    if (brand_id) { params.push(brand_id); query += ` AND a.brand_id = $${params.length}`; }
    if (contact_id) { params.push(contact_id); query += ` AND a.contact_id = $${params.length}`; }
    if (campaign_id) { params.push(campaign_id); query += ` AND a.campaign_id = $${params.length}`; }
    if (type) { params.push(type); query += ` AND a.type = $${params.length}`; }

    query += ' ORDER BY a.created_at DESC';
    params.push(parseInt(limit)); query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset)); query += ` OFFSET $${params.length}`;

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').split('ORDER BY')[0];

    const [result, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery.split('LIMIT')[0], params.slice(0, params.length - 2)),
    ]);

    res.json({
      items: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST log activity (internal use)
router.post('/', async (req, res) => {
  const { contact_id, campaign_id, brand_id, type, description, metadata } = req.body;
  if (!type || !description) return res.status(400).json({ error: 'type and description required' });
  try {
    const result = await db.query(
      'INSERT INTO activity_log (contact_id, campaign_id, brand_id, type, description, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [contact_id || null, campaign_id || null, brand_id || null, type, description, metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET activity types (for filter dropdowns)
router.get('/types', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT type FROM activity_log ORDER BY type');
    res.json(result.rows.map(r => r.type));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
