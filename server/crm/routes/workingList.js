const express = require("express");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { query } = require("../../db");
const {
  importWorkingListContacts,
  parseBuyerWorkingListBuffer,
  parseWorkingListBuffer,
  summarizeWorkingListContacts,
} = require("../../workingListImport");

const router = express.Router();
const SUMMER_AUCTION_PAGE_KEY = "summer-auction-experience-letter";
const DEFAULT_LIST_NAME = "Owners & Mobiles";
const BUYERS_LIST_NAME = "Buyers";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function uploadOwnerFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "The file must be 5 MB or smaller." });
    }
    return next(error);
  });
}

function cleanListName(value) {
  return String(value || DEFAULT_LIST_NAME).replace(/\s+/g, " ").trim();
}

function peopleFilters(search, group, listName) {
  const conditions = ["list_name = $1"];
  const params = [listName];

  if (group === "__small__") {
    conditions.push(`(
      COALESCE(NULLIF(BTRIM(suburb), ''), '') = ''
      OR COALESCE(NULLIF(BTRIM(suburb), ''), '') IN (
        SELECT COALESCE(NULLIF(BTRIM(suburb), ''), '')
        FROM working_list_people
        WHERE list_name = $1
        GROUP BY 1
        HAVING COUNT(*) < 10
      )
    )`);
  } else if (group && group !== "all") {
    params.push(group);
    conditions.push(`suburb = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const index = params.length;
    conditions.push(`(
      name ILIKE $${index}
      OR phone ILIKE $${index}
      OR COALESCE(email, '') ILIKE $${index}
      OR COALESCE(details, '') ILIKE $${index}
      OR COALESCE(suburb, '') ILIKE $${index}
      OR COALESCE(address, '') ILIKE $${index}
    )`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

async function getSummerAuctionPageToken() {
  let result = await query(
    "SELECT token FROM working_list_private_pages WHERE page_key = $1",
    [SUMMER_AUCTION_PAGE_KEY]
  );
  if (!result.rowCount) {
    await query(`
      INSERT INTO working_list_private_pages (page_key, token)
      VALUES ($1, $2)
      ON CONFLICT (page_key) DO NOTHING
    `, [SUMMER_AUCTION_PAGE_KEY, crypto.randomBytes(32).toString("hex")]);
    result = await query(
      "SELECT token FROM working_list_private_pages WHERE page_key = $1",
      [SUMMER_AUCTION_PAGE_KEY]
    );
  }
  return result.rows[0].token;
}

function summerAuctionPageUrl(req, token) {
  const path = `/summer-auction-experience/${token}`;
  const protocol = (req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return new URL(path, `${protocol}://${host}`).toString();
}

router.get("/lists", async (req, res) => {
  try {
    const result = await query(`
      SELECT list_name AS name, COUNT(*)::int AS count
      FROM working_list_people
      GROUP BY list_name
      ORDER BY list_name ASC
    `);
    res.json({ lists: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/groups", async (req, res) => {
  try {
    const listName = cleanListName(req.query.listName);
    const result = await query(`
      SELECT COALESCE(NULLIF(BTRIM(suburb), ''), '') AS suburb, COUNT(*)::int AS count
      FROM working_list_people
      WHERE list_name = $1
      GROUP BY 1
      ORDER BY 1 ASC
    `, [listName]);
    const groups = [];
    if (listName !== BUYERS_LIST_NAME) {
      groups.push(...result.rows
        .filter((row) => row.suburb && row.count >= 10)
        .map((row) => ({ key: row.suburb, label: row.suburb, count: row.count })));
      const otherCount = result.rows
        .filter((row) => !row.suburb || row.count < 10)
        .reduce((sum, row) => sum + row.count, 0);
      if (otherCount) {
        groups.push({
          key: "__small__",
          label: "Other suburbs (<10 each)",
          count: otherCount,
        });
      }
    }

    res.json({
      listName,
      total: result.rows.reduce((sum, row) => sum + row.count, 0),
      groups,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/import", uploadOwnerFile, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a CSV or Excel file to import." });
  if (![".csv", ".xlsx"].includes(path.extname(req.file.originalname).toLowerCase())) {
    return res.status(400).json({ error: "Only CSV and XLSX files are supported." });
  }

  const listName = cleanListName(req.body.listName);
  if (!listName || listName.length > 120) {
    return res.status(400).json({ error: "List name must be between 1 and 120 characters." });
  }

  let parsed;
  try {
    parsed = listName === BUYERS_LIST_NAME
      ? parseBuyerWorkingListBuffer(req.file.buffer)
      : parseWorkingListBuffer(req.file.buffer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const contacts = parsed.contacts.map((contact) => ({ ...contact, listName }));
    const imported = await importWorkingListContacts(contacts);
    const summary = summarizeWorkingListContacts(contacts);
    res.status(201).json({
      imported,
      skipped: parsed.skipped,
      duplicates: parsed.duplicates || 0,
      sourceRows: parsed.sourceRows,
      listName,
      total: summary.total,
      groups: listName === BUYERS_LIST_NAME ? [] : summary.groups,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/people", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const group = String(req.query.group || "all");
    const listName = cleanListName(req.query.listName);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { where, params } = peopleFilters(search, group, listName);

    const people = await query(`
      SELECT id, name, phone, email, details, suburb, address, list_name, updated_at
      FROM working_list_people
      ${where}
      ORDER BY suburb ASC NULLS LAST, name ASC, address ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const count = await query(`
      SELECT COUNT(*)::int AS total
      FROM working_list_people
      ${where}
    `, params);

    res.json({ people: people.rows, total: count.rows[0].total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/people", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    const email = String(req.body.email || "").trim();
    const details = String(req.body.details || "").trim();
    const suburb = String(req.body.suburb || "").trim();
    const address = String(req.body.address || "").trim();
    const listName = cleanListName(req.body.listName);
    if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
    if (!listName || listName.length > 120) return res.status(400).json({ error: "List name must be between 1 and 120 characters." });

    const result = await query(`
      INSERT INTO working_list_people (name, phone, email, details, suburb, address, list_name)
      VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, $7)
      ON CONFLICT (name, phone, address, list_name) DO UPDATE
      SET email = EXCLUDED.email, details = EXCLUDED.details,
          suburb = EXCLUDED.suburb, updated_at = NOW()
      RETURNING id, name, phone, email, details, suburb, address, list_name, updated_at
    `, [name, phone, email, details, suburb, address, listName]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/people/:id", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    const email = String(req.body.email || "").trim();
    const details = String(req.body.details || "").trim();
    const suburb = String(req.body.suburb || "").trim();
    const address = String(req.body.address || "").trim();
    const listName = cleanListName(req.body.listName);
    if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
    if (!listName || listName.length > 120) return res.status(400).json({ error: "List name must be between 1 and 120 characters." });

    const result = await query(`
      UPDATE working_list_people
      SET name = $1, phone = $2, email = NULLIF($3, ''), details = $4,
          suburb = NULLIF($5, ''), address = $6, list_name = $7, updated_at = NOW()
      WHERE id = $8
      RETURNING id, name, phone, email, details, suburb, address, list_name, updated_at
    `, [name, phone, email, details, suburb, address, listName, req.params.id]);

    if (!result.rowCount) return res.status(404).json({ error: "Contact not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/people/:id", async (req, res) => {
  try {
    const result = await query("DELETE FROM working_list_people WHERE id = $1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Contact not found" });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/template", async (req, res) => {
  try {
    const sendDate = req.query.date || new Date().toISOString().slice(0, 10);
    const result = await query(
      "SELECT send_date, message FROM working_list_templates WHERE send_date = $1",
      [sendDate]
    );
    res.json({ date: sendDate, message: result.rows[0]?.message || "" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/template", async (req, res) => {
  try {
    const sendDate = req.body.date || new Date().toISOString().slice(0, 10);
    const message = String(req.body.message || "").trim();
    const result = await query(`
      INSERT INTO working_list_templates (send_date, message)
      VALUES ($1, $2)
      ON CONFLICT (send_date) DO UPDATE
      SET message = EXCLUDED.message, updated_at = NOW()
      RETURNING send_date, message
    `, [sendDate, message]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/summer-auction-link", async (req, res) => {
  try {
    const token = await getSummerAuctionPageToken();
    res.json({ url: summerAuctionPageUrl(req, token) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/summer-auction-link/rotate", async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO working_list_private_pages (page_key, token)
      VALUES ($1, $2)
      ON CONFLICT (page_key) DO UPDATE
      SET token = EXCLUDED.token, updated_at = NOW()
      RETURNING token
    `, [SUMMER_AUCTION_PAGE_KEY, crypto.randomBytes(32).toString("hex")]);
    res.json({ url: summerAuctionPageUrl(req, result.rows[0].token) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/people/:id/send", async (req, res) => {
  try {
    const person = await query(
      "SELECT id, name, phone FROM working_list_people WHERE id = $1",
      [req.params.id]
    );
    if (!person.rowCount) return res.status(404).json({ error: "Contact not found" });

    const message = String(req.body.message || "").trim();
    await query(`
      INSERT INTO working_list_send_log (person_id, phone, message)
      VALUES ($1, $2, $3)
    `, [person.rows[0].id, person.rows[0].phone, message]);

    res.status(201).json({ logged: true, person: person.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
