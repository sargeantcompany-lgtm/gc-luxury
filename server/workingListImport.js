const XLSX = require("xlsx");
const { ensureSchema, pool } = require("./db");

function clean(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSuburb(address) {
  const parts = clean(address).split(",");
  if (parts.length < 2) return "";
  const locality = parts[parts.length - 1].trim();
  const withState = locality.match(/^(.+?)\s+(?:QLD|NSW|VIC|TAS|SA|WA|NT|ACT)\s+\d{4}$/i);
  const withPostcode = locality.match(/^(.+?)\s+\d{4}$/i);
  return (withState?.[1] || withPostcode?.[1] || "").trim();
}

function normalizePhone(value) {
  const phone = clean(value);
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return phone.startsWith("+") ? `+${digits}` : digits;
}

function parseWorkingListBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The file does not contain a worksheet.");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const headers = (rows[0] || []).map((value) => clean(value).toLowerCase());
  const columns = {
    address: headers.indexOf("address"),
    owner: headers.indexOf("owner"),
    mobile: headers.indexOf("mobile"),
    match: headers.indexOf("match"),
  };
  if (columns.address < 0 || columns.owner < 0 || columns.mobile < 0) {
    throw new Error("The file must include Address, Owner, and Mobile columns.");
  }

  const contacts = new Map();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const name = clean(row[columns.owner]);
    const address = clean(row[columns.address]);
    const suburb = parseSuburb(address);
    const match = columns.match >= 0 ? clean(row[columns.match]) : "";
    const details = match ? `Match: ${match}` : "";
    const phones = [...new Set(
      clean(row[columns.mobile])
        .split(/[;,|/]/)
        .map(normalizePhone)
        .filter((phone) => phone && !/^(?:notprovided|na|none|#)$/i.test(phone.replace(/\s/g, "")))
    )];

    if (!name || !phones.length) {
      skipped += 1;
      continue;
    }

    for (const phone of phones) {
      const contact = { name, phone, address, suburb, details };
      contacts.set(JSON.stringify([name, phone, address]), contact);
    }
  }

  return { contacts: [...contacts.values()], skipped, sourceRows: Math.max(0, rows.length - 1) };
}

function summarizeWorkingListContacts(contacts) {
  const suburbCounts = new Map();
  for (const contact of contacts) {
    const suburb = contact.suburb || "";
    suburbCounts.set(suburb, (suburbCounts.get(suburb) || 0) + 1);
  }

  const groups = [...suburbCounts.entries()]
    .filter(([suburb, count]) => suburb && count >= 10)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([suburb, count]) => ({ key: suburb, label: suburb, count }));
  const otherCount = [...suburbCounts.entries()]
    .filter(([suburb, count]) => !suburb || count < 10)
    .reduce((sum, [, count]) => sum + count, 0);

  if (otherCount) {
    groups.push({ key: "__small__", label: "Other suburbs (<10 each)", count: otherCount });
  }
  return { total: contacts.length, groups };
}

async function importWorkingListContacts(contacts, options = {}) {
  if (options.ensureSchema) await ensureSchema();
  const client = await pool.connect();
  let imported = 0;

  try {
    await client.query("BEGIN");
    for (const contact of contacts) {
      const listName = contact.listName || "Owners & Mobiles";
      const legacy = await client.query(`
        UPDATE working_list_people AS person
        SET details = CASE WHEN $3 = '' THEN person.details ELSE $3 END,
            suburb = NULLIF($4, ''),
            address = $5,
            updated_at = NOW()
        WHERE person.name = $1 AND person.phone = $2 AND person.address = ''
          AND person.list_name = $6
          AND $5 <> ''
          AND NOT EXISTS (
            SELECT 1 FROM working_list_people AS existing
            WHERE existing.name = $1 AND existing.phone = $2 AND existing.address = $5
              AND existing.list_name = $6
          )
        RETURNING person.id
      `, [contact.name, contact.phone, contact.details, contact.suburb, contact.address, listName]);

      if (!legacy.rowCount) {
        await client.query(`
          INSERT INTO working_list_people (name, phone, details, suburb, address, list_name)
          VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6)
          ON CONFLICT (name, phone, address, list_name) DO UPDATE
          SET details = CASE
                WHEN EXCLUDED.details = '' THEN working_list_people.details
                ELSE EXCLUDED.details
              END,
              suburb = EXCLUDED.suburb,
              updated_at = NOW()
        `, [contact.name, contact.phone, contact.details, contact.suburb, contact.address, listName]);
      }
      imported += 1;
    }
    await client.query("COMMIT");
    return imported;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  importWorkingListContacts,
  parseWorkingListBuffer,
  summarizeWorkingListContacts,
};
