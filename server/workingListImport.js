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

function parseBuyerWorkingListBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The file does not contain a worksheet.");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const headers = (rows[0] || []).map((value) => clean(value).toLowerCase());
  if (
    headers.length < 8 ||
    headers[7] !== "entered" ||
    headers.slice(0, 7).some(Boolean)
  ) {
    throw new Error("The Buyers list must use the original Working List sheet export.");
  }

  const contacts = new Map();
  let skipped = 0;
  let duplicates = 0;
  for (const row of rows.slice(1)) {
    const name = clean(row[0]);
    const email = clean(row[2]);
    const details = row.slice(3, 7).map(clean).filter(Boolean).join(" · ");
    const phones = [...new Set(
      clean(row[1])
        .split(/[;,|/]/)
        .map(normalizePhone)
        .filter((phone) => phone && !/^(?:notprovided|na|none|#)$/i.test(phone.replace(/\s/g, "")))
    )];

    if (!name || !phones.length) {
      skipped += 1;
      continue;
    }

    for (const phone of phones) {
      const key = JSON.stringify([name.toLowerCase(), phone]);
      const previous = contacts.get(key);
      if (previous) {
        duplicates += 1;
        contacts.set(key, {
          ...previous,
          email: email || previous.email,
          details: [...new Set([previous.details, details].filter(Boolean))].join(" · "),
        });
      } else {
        contacts.set(key, { name, phone, email, details, suburb: "", address: "" });
      }
    }
  }

  return {
    contacts: [...contacts.values()],
    skipped,
    duplicates,
    sourceRows: Math.max(0, rows.length - 1),
  };
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
        SET email = COALESCE(NULLIF($3, ''), person.email),
            details = CASE WHEN $4 = '' THEN person.details ELSE $4 END,
            suburb = NULLIF($5, ''),
            address = $6,
            updated_at = NOW()
        WHERE person.name = $1 AND person.phone = $2 AND person.address = ''
          AND person.list_name = $7
          AND $6 <> ''
          AND NOT EXISTS (
            SELECT 1 FROM working_list_people AS existing
            WHERE existing.name = $1 AND existing.phone = $2 AND existing.address = $6
              AND existing.list_name = $7
          )
        RETURNING person.id
      `, [contact.name, contact.phone, contact.email || "", contact.details, contact.suburb, contact.address, listName]);

      if (!legacy.rowCount) {
        await client.query(`
          INSERT INTO working_list_people (name, phone, email, details, suburb, address, list_name)
          VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, $7)
          ON CONFLICT (name, phone, address, list_name) DO UPDATE
          SET email = COALESCE(NULLIF(EXCLUDED.email, ''), working_list_people.email),
              details = CASE
                WHEN EXCLUDED.details = '' THEN working_list_people.details
                ELSE EXCLUDED.details
              END,
              suburb = EXCLUDED.suburb,
              updated_at = NOW()
        `, [contact.name, contact.phone, contact.email || "", contact.details, contact.suburb, contact.address, listName]);
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
  parseBuyerWorkingListBuffer,
  summarizeWorkingListContacts,
};
