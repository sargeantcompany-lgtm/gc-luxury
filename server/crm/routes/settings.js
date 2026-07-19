const express = require('express');
const router = express.Router();
const db = require('../../db');
const nodemailer = require('nodemailer');

// GET SMTP settings for a brand
router.get('/smtp/:brandId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, brand_id, host, port, secure, username, from_name, from_email, created_at, updated_at FROM smtp_settings WHERE brand_id=$1',
      [req.params.brandId]
    );
    if (!result.rows.length) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all SMTP settings (without passwords)
router.get('/smtp', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.brand_id, s.host, s.port, s.secure, s.username, s.from_name, s.from_email,
              b.name as brand_name, b.color as brand_color
       FROM smtp_settings s
       LEFT JOIN brands b ON s.brand_id = b.id
       ORDER BY b.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PUT save SMTP settings
router.post('/smtp', async (req, res) => {
  const { brand_id, host, port, secure, username, password, from_name, from_email } = req.body;
  if (!brand_id || !host || !username || !from_email) {
    return res.status(400).json({ error: 'brand_id, host, username, and from_email are required' });
  }
  try {
    // Check if exists
    const existing = await db.query('SELECT id FROM smtp_settings WHERE brand_id=$1', [brand_id]);
    let result;
    if (existing.rows.length) {
      // Update (only update password if provided)
      if (password) {
        result = await db.query(
          `UPDATE smtp_settings SET host=$1, port=$2, secure=$3, username=$4, password_encrypted=$5,
           from_name=$6, from_email=$7, updated_at=NOW() WHERE brand_id=$8 RETURNING id, brand_id, host, port, secure, username, from_name, from_email`,
          [host, port || 587, secure || false, username, password, from_name || null, from_email, brand_id]
        );
      } else {
        result = await db.query(
          `UPDATE smtp_settings SET host=$1, port=$2, secure=$3, username=$4,
           from_name=$5, from_email=$6, updated_at=NOW() WHERE brand_id=$7 RETURNING id, brand_id, host, port, secure, username, from_name, from_email`,
          [host, port || 587, secure || false, username, from_name || null, from_email, brand_id]
        );
      }
    } else {
      if (!password) return res.status(400).json({ error: 'password is required for new SMTP config' });
      result = await db.query(
        `INSERT INTO smtp_settings (brand_id, host, port, secure, username, password_encrypted, from_name, from_email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, brand_id, host, port, secure, username, from_name, from_email`,
        [brand_id, host, port || 587, secure || false, username, password, from_name || null, from_email]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST test SMTP connection
router.post('/smtp/test', async (req, res) => {
  const { brand_id, to_email } = req.body;
  try {
    const smtpResult = await db.query(
      'SELECT * FROM smtp_settings WHERE brand_id=$1', [brand_id]
    );
    if (!smtpResult.rows.length) return res.status(404).json({ error: 'SMTP settings not found for this brand' });
    const s = smtpResult.rows[0];

    const transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: { user: s.username, pass: s.password_encrypted },
    });

    await transporter.sendMail({
      from: `"${s.from_name || 'Outreach HQ'}" <${s.from_email}>`,
      to: to_email || s.from_email,
      subject: 'Outreach HQ — SMTP Test',
      text: 'Your SMTP configuration is working correctly!',
    });

    res.json({ success: true, message: `Test email sent to ${to_email || s.from_email}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE SMTP settings
router.delete('/smtp/:brandId', async (req, res) => {
  try {
    await db.query('DELETE FROM smtp_settings WHERE brand_id=$1', [req.params.brandId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
