const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { Readable } = require('stream');
const db = require('../../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PIPELINE_STAGES = ['New', 'Contacted', 'Warm', 'Meeting Booked', 'Listed'];

// ─── LIST contacts ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      brand_id, stage, dnc, search,
      page = 1, limit = 50, sort = 'created_at', order = 'DESC'
    } = req.query;

    const safeSort = ['first_name','last_name','email','phone','pipeline_stage','created_at','updated_at'].includes(sort) ? sort : 'created_at';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    const params = [];

    if (brand_id) { params.push(brand_id); where.push(`c.brand_id = $${params.length}`); }
    if (stage) { params.push(stage); where.push(`c.pipeline_stage = $${params.length}`); }
    if (dnc === 'true') { where.push(`c.do_not_contact = TRUE`); }
    if (dnc === 'false') { where.push(`c.do_not_contact = FALSE`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.city ILIKE $${params.length})`);
    }

    const whereStr = where.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM contacts c WHERE ${whereStr}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    params.push(parseInt(limit)); const limitIdx = params.length;
    params.push(offset); const offsetIdx = params.length;

    const result = await db.query(
      `SELECT c.*, b.name as brand_name, b.color as brand_color
       FROM contacts c
       LEFT JOIN brands b ON c.brand_id = b.id
       WHERE ${whereStr}
       ORDER BY c.${safeSort} ${safeOrder}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    res.json({
      contacts: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPORT contacts as CSV ───────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const { brand_id, stage, dnc, search } = req.query;
    let where = ['1=1'];
    const params = [];
    if (brand_id) { params.push(brand_id); where.push(`c.brand_id = $${params.length}`); }
    if (stage) { params.push(stage); where.push(`c.pipeline_stage = $${params.length}`); }
    if (dnc === 'true') where.push(`c.do_not_contact = TRUE`);
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
    }

    const result = await db.query(
      `SELECT c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip,
              c.pipeline_stage, c.source, c.do_not_contact, c.dnc_reason, b.name as brand,
              c.created_at
       FROM contacts c
       LEFT JOIN brands b ON c.brand_id = b.id
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC`,
      params
    );

    const headers = ['first_name','last_name','email','phone','address','city','state','zip','pipeline_stage','source','do_not_contact','dnc_reason','brand','created_at'];
    const csvRows = [headers.join(',')];
    for (const row of result.rows) {
      csvRows.push(headers.map(h => {
        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
        return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET pipeline stage counts ────────────────────────────────────
router.get('/pipeline-counts', async (req, res) => {
  try {
    const { brand_id } = req.query;
    let query = `SELECT pipeline_stage, COUNT(*) as count FROM contacts WHERE do_not_contact = FALSE`;
    const params = [];
    if (brand_id) { params.push(brand_id); query += ` AND brand_id = $${params.length}`; }
    query += ' GROUP BY pipeline_stage';
    const result = await db.query(query, params);

    const counts = {};
    PIPELINE_STAGES.forEach(s => counts[s] = 0);
    result.rows.forEach(r => counts[r.pipeline_stage] = parseInt(r.count));
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single contact ───────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, b.name as brand_name, b.color as brand_color
       FROM contacts c LEFT JOIN brands b ON c.brand_id = b.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE contact ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { brand_id, first_name, last_name, email, phone, address, city, state, zip, pipeline_stage, source } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO contacts (brand_id, first_name, last_name, email, phone, address, city, state, zip, pipeline_stage, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [brand_id || null, first_name || '', last_name || '', email || null, phone || null,
       address || null, city || null, state || null, zip || null,
       pipeline_stage || 'New', source || null]
    );
    await db.query(
      `INSERT INTO activity_log (contact_id, brand_id, type, description) VALUES ($1,$2,$3,$4)`,
      [result.rows[0].id, brand_id || null, 'contact_created', `Contact created: ${first_name} ${last_name}`]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE contact ───────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { brand_id, first_name, last_name, email, phone, address, city, state, zip, pipeline_stage, source } = req.body;
  try {
    const result = await db.query(
      `UPDATE contacts SET brand_id=$1, first_name=$2, last_name=$3, email=$4, phone=$5, address=$6,
       city=$7, state=$8, zip=$9, pipeline_stage=$10, source=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [brand_id || null, first_name, last_name, email, phone, address, city, state, zip,
       pipeline_stage || 'New', source || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE pipeline stage ────────────────────────────────────────
router.patch('/:id/stage', async (req, res) => {
  const { stage } = req.body;
  if (!PIPELINE_STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
  try {
    const result = await db.query(
      'UPDATE contacts SET pipeline_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [stage, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    await db.query(
      `INSERT INTO activity_log (contact_id, brand_id, type, description)
       VALUES ($1,$2,$3,$4)`,
      [req.params.id, result.rows[0].brand_id, 'stage_changed', `Stage changed to ${stage}`]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE contact ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM contacts WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BULK delete ──────────────────────────────────────────────────
router.post('/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
  try {
    await db.query('DELETE FROM contacts WHERE id = ANY($1)', [ids]);
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BULK stage update ────────────────────────────────────────────
router.post('/bulk-stage', async (req, res) => {
  const { ids, stage } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
  if (!PIPELINE_STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
  try {
    await db.query('UPDATE contacts SET pipeline_stage=$1, updated_at=NOW() WHERE id = ANY($2)', [stage, ids]);
    res.json({ success: true, updated: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NOTES ────────────────────────────────────────────────────────
router.get('/:id/notes', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM contact_notes WHERE contact_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/notes', async (req, res) => {
  const { note, created_by } = req.body;
  if (!note) return res.status(400).json({ error: 'note is required' });
  try {
    const result = await db.query(
      'INSERT INTO contact_notes (contact_id, note, created_by) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, note, created_by || 'Admin']
    );
    await db.query(
      `INSERT INTO activity_log (contact_id, type, description) VALUES ($1,$2,$3)`,
      [req.params.id, 'note_added', `Note added: ${note.substring(0, 80)}${note.length > 80 ? '...' : ''}`]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    await db.query('DELETE FROM contact_notes WHERE id=$1 AND contact_id=$2', [req.params.noteId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DNC (Do Not Contact) ─────────────────────────────────────────
router.post('/:id/dnc', async (req, res) => {
  const { reason } = req.body;
  try {
    const result = await db.query(
      'UPDATE contacts SET do_not_contact=TRUE, dnc_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [reason || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    await db.query(
      `INSERT INTO activity_log (contact_id, brand_id, type, description) VALUES ($1,$2,$3,$4)`,
      [req.params.id, result.rows[0].brand_id, 'dnc_added', `Added to Do Not Contact list. Reason: ${reason || 'Not specified'}`]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/dnc', async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE contacts SET do_not_contact=FALSE, dnc_reason=NULL, updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Contact not found' });
    await db.query(
      `INSERT INTO activity_log (contact_id, brand_id, type, description) VALUES ($1,$2,$3,$4)`,
      [req.params.id, result.rows[0].brand_id, 'dnc_removed', 'Removed from Do Not Contact list']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── IMPORT CSV / XLSX ────────────────────────────────────────────
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { brand_id, skip_duplicates = 'true' } = req.body;

  const normalize = (row) => {
    const r = {};
    for (const key of Object.keys(row)) r[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
    return r;
  };

  const mapRow = (r) => ({
    brand_id: brand_id || null,
    first_name: r.first_name || r.firstname || r.first || '',
    last_name: r.last_name || r.lastname || r.last || '',
    email: r.email || r.email_address || null,
    phone: r.phone || r.phone_number || r.mobile || r.cell || null,
    address: r.address || r.street || r.street_address || null,
    city: r.city || null,
    state: r.state || r.province || null,
    zip: r.zip || r.zip_code || r.postal_code || r.postal || null,
    pipeline_stage: r.pipeline_stage || r.stage || 'New',
    source: r.source || r.lead_source || 'Import',
  });

  try {
    let rows = [];

    if (req.file.originalname.match(/\.xlsx?$/i)) {
      const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    } else {
      // CSV
      await new Promise((resolve, reject) => {
        const readable = Readable.from(req.file.buffer.toString());
        readable.pipe(csv())
          .on('data', (row) => rows.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
    }

    let imported = 0, skipped = 0, errors = 0;

    for (const rawRow of rows) {
      const r = mapRow(normalize(rawRow));
      try {
        if (skip_duplicates === 'true' && r.email) {
          const exists = await db.query('SELECT id FROM contacts WHERE email=$1', [r.email]);
          if (exists.rows.length) { skipped++; continue; }
        }
        await db.query(
          `INSERT INTO contacts (brand_id, first_name, last_name, email, phone, address, city, state, zip, pipeline_stage, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [r.brand_id, r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.state, r.zip, r.pipeline_stage, r.source]
        );
        imported++;
      } catch {
        errors++;
      }
    }

    if (brand_id) {
      await db.query(
        `INSERT INTO activity_log (brand_id, type, description, metadata) VALUES ($1,$2,$3,$4)`,
        [brand_id, 'import', `Imported ${imported} contacts from ${req.file.originalname}`, JSON.stringify({ imported, skipped, errors })]
      );
    }

    res.json({ success: true, imported, skipped, errors, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
