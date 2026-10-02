const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireAdmin } = require('../adminAuth');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 280) || 'post';
}

// Keep slugs unique by appending -2, -3, ... when one is already taken.
async function uniqueSlug(base, excludeId) {
  let slug = base;
  for (let n = 2; ; n++) {
    const params = [slug];
    let q = 'SELECT 1 FROM gc_blog_posts WHERE slug=$1';
    if (excludeId) {
      params.push(excludeId);
      q += ' AND id<>$2';
    }
    const result = await db.query(q, params);
    if (!result.rows.length) return slug;
    slug = `${base}-${n}`;
  }
}

// GET all posts including drafts - admin only. Declared before /:slug so
// "all" isn't treated as a slug.
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM gc_blog_posts ORDER BY COALESCE(published_at, created_at) DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET published posts - public. Body is omitted from the list; ?limit=N caps it.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await db.query(
      `SELECT id, title, slug, excerpt, cover_image, published_at FROM gc_blog_posts
       WHERE status='published' ORDER BY published_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single published post by slug - public
router.get('/:slug', async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM gc_blog_posts WHERE slug=$1 AND status='published'",
      [req.params.slug]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create post - admin only
router.post('/', requireAdmin, async (req, res) => {
  const { title, slug, excerpt, cover_image, body, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const finalSlug = await uniqueSlug(slugify(slug || title));
    const finalStatus = status === 'published' ? 'published' : 'draft';
    const result = await db.query(
      `INSERT INTO gc_blog_posts (title, slug, excerpt, cover_image, body, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $7::boolean THEN NOW() END) RETURNING *`,
      [title, finalSlug, excerpt || null, cover_image || null, body || null, finalStatus, finalStatus === 'published']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update post - admin only. published_at is set the first time a post
// goes live and kept on later edits.
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, slug, excerpt, cover_image, body, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const finalSlug = await uniqueSlug(slugify(slug || title), req.params.id);
    const finalStatus = status === 'published' ? 'published' : 'draft';
    const result = await db.query(
      `UPDATE gc_blog_posts SET title=$1, slug=$2, excerpt=$3, cover_image=$4, body=$5, status=$6,
         published_at = CASE WHEN $7::boolean THEN COALESCE(published_at, NOW()) ELSE published_at END,
         updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, finalSlug, excerpt || null, cover_image || null, body || null, finalStatus, finalStatus === 'published', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE post - admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM gc_blog_posts WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
