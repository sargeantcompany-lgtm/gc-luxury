const express = require('express');
const router = express.Router();
const checklists = require('../../listingChecklists');

function fail(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

// GET the checklist definition plus every listing's ticks and notes
router.get('/', async (req, res) => {
  try {
    res.json({ template: checklists.TEMPLATE, listings: await checklists.list() });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await checklists.create(req.body || {}));
  } catch (err) { fail(res, err); }
});

// PUT a partial update: { address?, seller?, items?: { key: { done?, note? } } }
router.put('/:id', async (req, res) => {
  try {
    res.json(await checklists.update(req.params.id, req.body || {}));
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    await checklists.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

module.exports = router;
