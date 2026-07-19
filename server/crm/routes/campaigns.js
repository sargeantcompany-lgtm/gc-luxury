const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const db = require('../../db');

const MERGE_TAGS = ['first_name','last_name','email','phone','address','city','state','zip','brand_name'];

function replaceMergeTags(text, contact, brandName) {
  if (!text) return '';
  return text
    .replace(/\{\{first_name\}\}/g, contact.first_name || '')
    .replace(/\{\{last_name\}\}/g, contact.last_name || '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{phone\}\}/g, contact.phone || '')
    .replace(/\{\{address\}\}/g, contact.address || '')
    .replace(/\{\{city\}\}/g, contact.city || '')
    .replace(/\{\{state\}\}/g, contact.state || '')
    .replace(/\{\{zip\}\}/g, contact.zip || '')
    .replace(/\{\{brand_name\}\}/g, brandName || '');
}

// ─── LIST campaigns ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { brand_id, type, status, page = 1, limit = 20 } = req.query;
    let where = ['1=1'];
    const params = [];
    if (brand_id) { params.push(brand_id); where.push(`c.brand_id = $${params.length}`); }
    if (type) { params.push(type); where.push(`c.type = $${params.length}`); }
    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }

    const whereStr = where.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countResult, result] = await Promise.all([
      db.query(`SELECT COUNT(*) as total FROM campaigns c WHERE ${whereStr}`, params),
      db.query(
        `SELECT c.*, b.name as brand_name, b.color as brand_color
         FROM campaigns c LEFT JOIN brands b ON c.brand_id = b.id
         WHERE ${whereStr}
         ORDER BY c.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]
      ),
    ]);

    res.json({
      campaigns: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single campaign ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, b.name as brand_name, b.color as brand_color
       FROM campaigns c LEFT JOIN brands b ON c.brand_id = b.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET campaign results ─────────────────────────────────────────
router.get('/:id/results', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cc.*, c.first_name, c.last_name, c.email, c.phone
       FROM campaign_contacts cc
       JOIN contacts c ON cc.contact_id = c.id
       WHERE cc.campaign_id = $1
       ORDER BY cc.sent_at DESC NULLS LAST`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE campaign ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { brand_id, name, type, subject, body, filters } = req.body;
  if (!name || !type || !body) return res.status(400).json({ error: 'name, type and body are required' });
  if (!['email', 'sms'].includes(type)) return res.status(400).json({ error: 'type must be email or sms' });
  if (type === 'email' && !subject) return res.status(400).json({ error: 'subject is required for email campaigns' });
  try {
    const result = await db.query(
      `INSERT INTO campaigns (brand_id, name, type, subject, body, filters)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [brand_id || null, name, type, subject || null, body, filters ? JSON.stringify(filters) : '{}']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE campaign ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { brand_id, name, type, subject, body, filters } = req.body;
  try {
    const result = await db.query(
      `UPDATE campaigns SET brand_id=$1, name=$2, type=$3, subject=$4, body=$5, filters=$6
       WHERE id=$7 AND status='draft' RETURNING *`,
      [brand_id || null, name, type, subject || null, body, filters ? JSON.stringify(filters) : '{}', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found or already sent' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE campaign ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM campaigns WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PREVIEW recipients ───────────────────────────────────────────
router.post('/:id/preview', async (req, res) => {
  try {
    const campaign = await db.query('SELECT * FROM campaigns WHERE id=$1', [req.params.id]);
    if (!campaign.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    const c = campaign.rows[0];
    const filters = c.filters || {};

    let where = ['do_not_contact = FALSE'];
    const params = [];
    if (c.brand_id) { params.push(c.brand_id); where.push(`brand_id = $${params.length}`); }
    if (filters.stage) { params.push(filters.stage); where.push(`pipeline_stage = $${params.length}`); }
    if (c.type === 'email') where.push(`email IS NOT NULL AND email != ''`);

    const result = await db.query(
      `SELECT COUNT(*) as total FROM contacts WHERE ${where.join(' AND ')}`, params
    );
    res.json({ recipient_count: parseInt(result.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEND email campaign ──────────────────────────────────────────
router.post('/:id/send', async (req, res) => {
  const campaignId = req.params.id;
  try {
    const campResult = await db.query(
      'SELECT c.*, b.name as brand_name FROM campaigns c LEFT JOIN brands b ON c.brand_id = b.id WHERE c.id=$1',
      [campaignId]
    );
    if (!campResult.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    const camp = campResult.rows[0];

    if (camp.status === 'sent') return res.status(400).json({ error: 'Campaign already sent' });
    if (camp.type === 'sms') return res.status(400).json({ error: 'Use /sms-links for SMS campaigns' });

    // Get SMTP settings
    const smtpResult = await db.query('SELECT * FROM smtp_settings WHERE brand_id=$1', [camp.brand_id]);
    if (!smtpResult.rows.length) {
      return res.status(400).json({ error: 'No SMTP settings configured for this brand. Please configure SMTP in Settings.' });
    }
    const smtp = smtpResult.rows[0];

    // Query target contacts
    const filters = camp.filters || {};
    let where = [`do_not_contact = FALSE`, `email IS NOT NULL`, `email != ''`];
    const params = [];
    if (camp.brand_id) { params.push(camp.brand_id); where.push(`brand_id = $${params.length}`); }
    if (filters.stage) { params.push(filters.stage); where.push(`pipeline_stage = $${params.length}`); }

    const contactsResult = await db.query(
      `SELECT * FROM contacts WHERE ${where.join(' AND ')}`, params
    );
    const contacts = contactsResult.rows;

    if (!contacts.length) {
      return res.status(400).json({ error: 'No eligible contacts found for this campaign' });
    }

    // Mark campaign as sending
    await db.query(
      'UPDATE campaigns SET status=$1, total_recipients=$2 WHERE id=$3',
      ['sending', contacts.length, campaignId]
    );

    // Immediately return — sending happens async
    res.json({
      success: true,
      message: `Sending to ${contacts.length} contacts...`,
      total: contacts.length,
    });

    // ── Async email send ──
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.username, pass: smtp.password_encrypted },
    });

    let sentCount = 0, failedCount = 0;

    for (const contact of contacts) {
      try {
        const personalSubject = replaceMergeTags(camp.subject, contact, camp.brand_name);
        const personalBody = replaceMergeTags(camp.body, contact, camp.brand_name);

        await transporter.sendMail({
          from: `"${smtp.from_name || camp.brand_name}" <${smtp.from_email}>`,
          to: contact.email,
          subject: personalSubject,
          text: personalBody,
          html: personalBody.replace(/\n/g, '<br>'),
        });

        await db.query(
          `INSERT INTO campaign_contacts (campaign_id, contact_id, status, sent_at)
           VALUES ($1,$2,'sent',NOW())
           ON CONFLICT (campaign_id, contact_id) DO UPDATE SET status='sent', sent_at=NOW()`,
          [campaignId, contact.id]
        );
        sentCount++;
      } catch (err) {
        await db.query(
          `INSERT INTO campaign_contacts (campaign_id, contact_id, status, error_message)
           VALUES ($1,$2,'failed',$3)
           ON CONFLICT (campaign_id, contact_id) DO UPDATE SET status='failed', error_message=$3`,
          [campaignId, contact.id, err.message]
        );
        failedCount++;
      }
    }

    await db.query(
      `UPDATE campaigns SET status='sent', sent_count=$1, failed_count=$2, sent_at=NOW() WHERE id=$3`,
      [sentCount, failedCount, campaignId]
    );

    await db.query(
      `INSERT INTO activity_log (campaign_id, brand_id, type, description, metadata)
       VALUES ($1,$2,$3,$4,$5)`,
      [campaignId, camp.brand_id, 'campaign_sent',
       `Campaign "${camp.name}" sent: ${sentCount} delivered, ${failedCount} failed`,
       JSON.stringify({ sent: sentCount, failed: failedCount, total: contacts.length })]
    );
  } catch (err) {
    await db.query('UPDATE campaigns SET status=$1 WHERE id=$2', ['failed', campaignId]);
    console.error('Send error:', err.message);
  }
});

// ─── GENERATE SMS links ───────────────────────────────────────────
router.post('/:id/sms-links', async (req, res) => {
  const campaignId = req.params.id;
  try {
    const campResult = await db.query(
      'SELECT c.*, b.name as brand_name FROM campaigns c LEFT JOIN brands b ON c.brand_id = b.id WHERE c.id=$1',
      [campaignId]
    );
    if (!campResult.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    const camp = campResult.rows[0];

    const filters = camp.filters || {};
    let where = [`do_not_contact = FALSE`, `phone IS NOT NULL`, `phone != ''`];
    const params = [];
    if (camp.brand_id) { params.push(camp.brand_id); where.push(`brand_id = $${params.length}`); }
    if (filters.stage) { params.push(filters.stage); where.push(`pipeline_stage = $${params.length}`); }

    const contactsResult = await db.query(
      `SELECT * FROM contacts WHERE ${where.join(' AND ')}`, params
    );

    const links = contactsResult.rows.map(contact => {
      const message = replaceMergeTags(camp.body, contact, camp.brand_name);
      const cleanPhone = contact.phone.replace(/\D/g, '');
      const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
      return {
        contact_id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        phone: contact.phone,
        sms_link: smsLink,
        message,
      };
    });

    // Mark campaign as sent for SMS
    await db.query(
      'UPDATE campaigns SET status=$1, total_recipients=$2, sent_count=$3, sent_at=NOW() WHERE id=$4',
      ['sent', links.length, links.length, campaignId]
    );

    await db.query(
      `INSERT INTO activity_log (campaign_id, brand_id, type, description, metadata)
       VALUES ($1,$2,$3,$4,$5)`,
      [campaignId, camp.brand_id, 'sms_links_generated',
       `SMS links generated for campaign "${camp.name}": ${links.length} contacts`,
       JSON.stringify({ count: links.length })]
    );

    res.json({ success: true, links, total: links.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
