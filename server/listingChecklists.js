const db = require("./db");

// The Property Listing & Sales Checklist, shared by the CRM (/admin → Listing
// Checklists) and Adam's admin (/adam/admin → Listings). Both pages render it
// from this definition and read/write the same listing_checklists rows.
//
// Each item's `key` is what's stored against a listing, so never change or
// reuse a key - to reword an item edit its text, to add one give it a new key.
const TEMPLATE = [
  { title: "1. Appraisal & seller setup", items: [
    { key: "appraisal", text: "Complete property appraisal" },
    { key: "cma-form6", text: "Add CMA to Form 6" },
    { key: "seller-aml", text: "Complete Seller AML registration" },
    { key: "seller-contact", text: "Obtain seller contact details" },
    { key: "seller-title", text: "Confirm seller title/ownership details" },
    { key: "form6-prepare", text: "Prepare Form 6" },
    { key: "engagement-term", text: "Confirm term of engagement (90 days?)" },
    { key: "engagement-nature", text: "Confirm nature of engagement (Exclusive/Open?)" },
    { key: "commission", text: "Confirm commission, including GST" },
    { key: "form6-signed", text: "Obtain seller signatures on Form 6" },
    { key: "form6-submit", text: "Submit completed Form 6 to Ray White Admin (via link)" },
    { key: "form6-docusign", text: "Provide details to Admin for Docusigning" },
  ], tip: "Check names on the Form 6 match the registered ownership details before submitting." },
  { title: "2. Marketing budget", items: [
    { key: "mb-photography", text: "Photography" },
    { key: "mb-signboard", text: "Signboard" },
    { key: "mb-brochures", text: "Brochures" },
    { key: "mb-dl-flyers", text: "DL flyers" },
    { key: "mb-online", text: "Online platforms" },
    { key: "mb-social", text: "Social media" },
    { key: "mb-misc", text: "Miscellaneous marketing expenses" },
    { key: "mb-docusign", text: "Provide details to Admin for Docusigning" },
  ] },
  { title: "3. Administration budget", items: [
    { key: "ab-aml", text: "AML charge" },
    { key: "ab-form2", text: "Form 2" },
    { key: "ab-other", text: "Other administration costs" },
    { key: "ab-docusign", text: "Advise Admin to send budgets and Form 6 to client for Docusigning" },
  ] },
  { title: "4. Campaign preparation (3 to 4 weeks)", items: [
    { key: "cp-calendar", text: "Add all following key dates to calendar and share with seller" },
    { key: "cp-photography", text: "Book photography" },
    { key: "cp-collateral", text: "Prepare marketing collateral" },
    { key: "cp-online", text: "Set up online advertising" },
    { key: "cp-live-date", text: "Confirm live online date" },
    { key: "cp-open-homes", text: "Schedule open homes" },
    { key: "cp-auction", text: "Confirm auction date, if applicable" },
    { sub: "Ongoing: follow up Form 2" },
    { key: "cp-file-admin", text: "Send completed file to Admin" },
    { key: "cp-form2-buyers", text: "Send Form 2 to prospective buyers upon request" },
  ], tip: "Work backwards from the live date so photography, copy, approvals and online advertising are ready before launch." },
  { title: "5. Property launch", items: [
    { key: "pl-live", text: "Property live online" },
    { key: "pl-signboard", text: "Signboard installed" },
    { key: "pl-brochures", text: "Brochures prepared" },
    { key: "pl-dl-flyers", text: "DL flyers distributed" },
    { key: "pl-database", text: "Buyer database notified" },
    { key: "pl-social", text: "Social media campaign launched" },
  ], tip: "Check every online advertisement immediately after launch for price, photos, spelling and property details. Don’t rely on accuracy of RP Data." },
  { title: "6. Open homes & ongoing marketing", items: [
    { key: "oh-confirm", text: "Confirm open homes with seller" },
    { key: "oh-conduct", text: "Conduct scheduled open homes" },
    { key: "oh-follow-up", text: "Follow up all attendees" },
    { key: "oh-database", text: "Update buyer database" },
    { key: "oh-social-tiles", text: "Prepare social media tiles weekly" },
    { key: "oh-notifications", text: "Continue buyer database notifications" },
    { key: "oh-vendor-reports", text: "Provide regular seller feedback/Vendor reports (Nurture Cloud)" },
  ], tip: "Follow up buyers as soon as possible after each open home while the property is fresh in their minds and their impressions/questions still fresh in your mind." },
  { title: "7. Offers & negotiation", items: [
    { key: "of-letter", text: "Secure written Letter of Offer" },
    { key: "of-present", text: "Present all offers to seller" },
    { key: "of-discuss", text: "Discuss price and conditions" },
    { key: "of-negotiate", text: "Negotiate between buyer and seller" },
    { key: "of-buyer-aml", text: "Complete Buyer AML registration" },
  ], tip: "Wherever possible, obtain offers in writing with price, deposit, settlement date and conditions clearly stated." },
  { title: "8. Contract execution", items: [
    { key: "ce-prepare", text: "Prepare contract documentation" },
    { key: "ce-buyer-details", text: "Confirm buyer details" },
    { key: "ce-seller-details", text: "Confirm seller details" },
    { key: "ce-buyer-sign", text: "Buyer signing" },
    { key: "ce-seller-sign", text: "Seller signing" },
    { key: "ce-submit", text: "Submit completed contract form to Contracts Department (via Form Process link)" },
    { key: "ce-contracts-process", text: "Follow Contracts Department email process from here (Philippa)" },
  ], tip: "Once executed, check that all signatures, dates, conditions, deposits and settlement details are correct." },
  { title: "9. Contract to settlement", items: [
    { key: "cs-dates", text: "Monitor important contract dates" },
    { key: "cs-conditions", text: "Follow up outstanding conditions" },
    { key: "cs-contracts", text: "Liaise with Contracts Department" },
    { key: "cs-updates", text: "Keep buyer and seller updated" },
    { key: "cs-pending", text: "Advise all parties of pending dates" },
    { key: "cs-arrangements", text: "Confirm settlement arrangements" },
  ], tip: "Keep ahead of critical dates rather than waiting for the buyer or seller to chase an update." },
  { title: "10. Settlement day", items: [
    { key: "sd-notification", text: "Await formal settlement notification from Contracts (Philippa)" },
    { key: "sd-confirm", text: "Confirm settlement has occurred" },
    { key: "sd-notify-seller", text: "Notify seller" },
    { key: "sd-notify-buyer", text: "Notify buyer" },
    { key: "sd-keys", text: "Arrange/provide property keys" },
    { key: "sd-gifts", text: "Provide settlement gifts" },
    { key: "sd-congratulate", text: "Congratulate buyer and seller" },
    { key: "sd-close-file", text: "Close and finalise property file" },
  ], tip: "Do not release keys until formal confirmation of settlement has been received." },
  { title: "Final check", items: [
    { key: "fc-compliance", text: "All compliance completed" },
    { key: "fc-documentation", text: "All documentation filed" },
    { key: "fc-accounts", text: "Commission and marketing accounted for" },
    { key: "fc-keys", text: "Keys handed over" },
    { key: "fc-gifts", text: "Settlement gifts delivered" },
    { key: "fc-thanked", text: "Buyer and seller thanked" },
  ] },
];

const KEYS = new Set(TEMPLATE.flatMap((s) => s.items.filter((i) => i.key).map((i) => i.key)));

class ChecklistError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function text(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function validId(id) {
  return /^\d{1,9}$/.test(String(id));
}

async function list() {
  const { rows } = await db.query("SELECT * FROM listing_checklists ORDER BY updated_at DESC");
  return rows;
}

async function create(body) {
  const address = text(body.address, 200);
  if (!address) throw new ChecklistError(400, "Property address is required");
  const { rows } = await db.query(
    "INSERT INTO listing_checklists (address, seller) VALUES ($1, $2) RETURNING *",
    [address, text(body.seller, 200) || null]
  );
  return rows[0];
}

// Partial update: only the fields and item keys sent are changed, so two
// devices ticking different items don't overwrite each other. The row is
// locked for the read-modify-write so concurrent saves can't interleave.
async function update(id, body) {
  if (!validId(id)) throw new ChecklistError(404, "Listing not found");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM listing_checklists WHERE id = $1 FOR UPDATE", [id]);
    if (!rows.length) throw new ChecklistError(404, "Listing not found");
    const row = rows[0];

    let address = row.address;
    if (body.address !== undefined) {
      address = text(body.address, 200);
      if (!address) throw new ChecklistError(400, "Property address is required");
    }
    const seller = body.seller !== undefined ? text(body.seller, 200) || null : row.seller;

    const items = row.items || {};
    if (body.items && typeof body.items === "object") {
      for (const [key, val] of Object.entries(body.items)) {
        if (!KEYS.has(key) || !val || typeof val !== "object") continue;
        const item = items[key] || { done: false, note: "", doneAt: null };
        if (val.done !== undefined) {
          const done = val.done === true;
          if (done !== item.done) item.doneAt = done ? new Date().toISOString() : null;
          item.done = done;
        }
        if (val.note !== undefined) item.note = text(val.note, 2000);
        items[key] = item;
      }
    }

    const result = await client.query(
      "UPDATE listing_checklists SET address = $2, seller = $3, items = $4, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id, address, seller, JSON.stringify(items)]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function remove(id) {
  if (!validId(id)) throw new ChecklistError(404, "Listing not found");
  const { rowCount } = await db.query("DELETE FROM listing_checklists WHERE id = $1", [id]);
  if (!rowCount) throw new ChecklistError(404, "Listing not found");
}

module.exports = { TEMPLATE, ChecklistError, list, create, update, remove };
