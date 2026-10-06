const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Adam Sargeant appraisal / offer / off-market site, served under /adam by
// server/index.js (ported from the standalone appraisal-proposal-tool app).
// Records are JSON files under DATA_DIR - on Railway that must point at a
// mounted volume, or everything is lost on redeploy.
const PUBLIC_DIR = path.join(__dirname, "..", "..", "agent", "public");
const DATA_DIR = process.env.AGENT_DATA_DIR || path.join(__dirname, "..", "..", "agent", "data");
const APPRAISALS_DIR = path.join(DATA_DIR, "appraisals");
const MAX_BODY_BYTES = 1024 * 1024; // 1MB — appraisal JSON has no embedded images, so this is generous
const ADMIN_PASSWORD = process.env.AGENT_ADMIN_PASSWORD || "";
const ADMIN_COOKIE = "admin_session";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const OFFER_LINKS_DIR = path.join(DATA_DIR, "offer-links");
const OFFERS_DIR = path.join(DATA_DIR, "offers");

const OM_LISTINGS_DIR = path.join(DATA_DIR, "off-market-listings");
const OM_ACCESS_DIR = path.join(DATA_DIR, "off-market-access");
const OM_PHOTOS_DIR = path.join(DATA_DIR, "off-market-photos");
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // admin page resizes before upload, so real photos land well under this

fs.mkdirSync(APPRAISALS_DIR, { recursive: true });
fs.mkdirSync(OFFER_LINKS_DIR, { recursive: true });
fs.mkdirSync(OFFERS_DIR, { recursive: true });
fs.mkdirSync(OM_LISTINGS_DIR, { recursive: true });
fs.mkdirSync(OM_ACCESS_DIR, { recursive: true });
fs.mkdirSync(OM_PHOTOS_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, contentType) {
  res.writeHead(status, { "Content-Type": contentType || "text/plain; charset=utf-8" });
  res.end(body);
}

function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), "application/json; charset=utf-8");
}

// Admin session: the cookie holds an HMAC derived from ADMIN_PASSWORD, so no
// server-side session store is needed, and changing the password logs
// everyone out.
function adminToken() {
  return crypto.createHmac("sha256", ADMIN_PASSWORD).update("admin-session-v1").digest("hex");
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const token = parseCookies(req)[ADMIN_COOKIE];
  return !!token && safeEqual(token, adminToken());
}

function setAdminCookie(req, res, value, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/adam; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

async function handleAdminLogin(req, res) {
  if (!ADMIN_PASSWORD) return sendJSON(res, 503, { error: "ADMIN_PASSWORD is not set on the server" });
  let password = "";
  try {
    password = (JSON.parse(await readBody(req)) || {}).password || "";
  } catch (e) {
    return sendJSON(res, 400, { error: "Invalid request" });
  }
  if (!safeEqual(password, ADMIN_PASSWORD)) return sendJSON(res, 401, { error: "Wrong password" });
  setAdminCookie(req, res, adminToken(), ADMIN_COOKIE_MAX_AGE);
  sendJSON(res, 200, { ok: true });
}

function readRaw(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readBody(req) {
  return (await readRaw(req, MAX_BODY_BYTES)).toString("utf8");
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix() {
  return crypto.randomBytes(3).toString("hex");
}

function appraisalPath(id) {
  return path.join(APPRAISALS_DIR, `${id}.json`);
}

async function handleSaveAppraisal(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJSON(res, 413, { error: "Request too large" });
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return sendJSON(res, 400, { error: "Invalid JSON" });
  }

  const address = (data && data.client && data.client.address) || "appraisal";
  const slug = slugify(address) || "appraisal";
  const id = `${slug}-${randomSuffix()}`;

  const record = {
    id,
    createdAt: new Date().toISOString(),
    address: (data && data.client && data.client.address) || "",
    clientName: (data && data.client && data.client.name) || "",
    data,
  };

  fs.writeFile(appraisalPath(id), JSON.stringify(record), (err) => {
    if (err) return sendJSON(res, 500, { error: "Could not save appraisal" });
    sendJSON(res, 200, { id });
  });
}

function handleGetAppraisal(req, res, id) {
  fs.readFile(appraisalPath(id), "utf8", (err, contents) => {
    if (err) return sendJSON(res, 404, { error: "Not found" });
    let record;
    try {
      record = JSON.parse(contents);
    } catch (e) {
      return sendJSON(res, 500, { error: "Corrupt record" });
    }
    sendJSON(res, 200, record.data);
  });
}

function handleListAppraisals(req, res) {
  fs.readdir(APPRAISALS_DIR, (err, files) => {
    if (err) return sendJSON(res, 500, { error: "Could not list appraisals" });
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const records = jsonFiles.map((f) => {
      try {
        const record = JSON.parse(fs.readFileSync(path.join(APPRAISALS_DIR, f), "utf8"));
        return { id: record.id, createdAt: record.createdAt, address: record.address, clientName: record.clientName };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    sendJSON(res, 200, records);
  });
}

/* ---------------- Offers ----------------
 * Online version of the Ray White "Letter of Offer". Adam creates an offer
 * link per property in /admin (/offer/:linkId); buyers submit offers through
 * it and each one is stored as a JSON file under DATA_DIR/offers.
 */

function readJSONDir(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function readOfferLink(id) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(OFFER_LINKS_DIR, `${id}.json`), "utf8"));
  } catch (e) {
    return null;
  }
}

function str(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Parses a dollar amount like "$1,250,000". Returns null when blank and NaN
// when it isn't a number (e.g. "1.2m"), so callers can tell the two apart.
function money(v) {
  const s = String(v == null ? "" : v).replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

async function readJSONBody(req, res) {
  try {
    return JSON.parse(await readBody(req)) || {};
  } catch (e) {
    sendJSON(res, 400, { error: "Invalid request" });
    return null;
  }
}

async function handleCreateOfferLink(req, res) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const address = str(body.address, 200);
  if (!address) return sendJSON(res, 400, { error: "Property address is required" });
  const id = `${slugify(address) || "property"}-${randomSuffix()}`;
  const record = { id, createdAt: new Date().toISOString(), address, agent: str(body.agent, 120) || "Adam Sargeant" };
  fs.writeFileSync(path.join(OFFER_LINKS_DIR, `${id}.json`), JSON.stringify(record));
  sendJSON(res, 200, record);
}

function validateOffer(body) {
  const errors = {};
  const offer = {
    buyerNames: str(body.buyerNames, 500),
    email: str(body.email, 200),
    mobile: str(body.mobile, 40),
    solicitor: str(body.solicitor, 500),
    purchasePrice: money(body.purchasePrice),
    initialDeposit: money(body.initialDeposit),
    balanceDeposit: money(body.balanceDeposit),
    balanceDepositPayableOn: str(body.balanceDepositPayableOn, 200),
    finance: body.finance === "yes" || body.finance === "no" ? body.finance : "",
    financeDays: str(body.financeDays, 10),
    pestBuilding: body.pestBuilding === "yes" || body.pestBuilding === "no" ? body.pestBuilding : "",
    pestBuildingDays: str(body.pestBuildingDays, 10),
    settlement: ["30", "45", "other"].includes(body.settlement) ? body.settlement : "",
    settlementOther: str(body.settlementOther, 200),
    otherTerms: str(body.otherTerms, 3000),
    signature: str(body.signature, 200),
    agreed: body.agreed === true,
  };

  if (!offer.buyerNames) errors.buyerNames = "Enter the buyer's full name(s)";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(offer.email)) errors.email = "Enter a valid email";
  if (offer.mobile.replace(/[^\d]/g, "").length < 8) errors.mobile = "Enter a valid mobile number";
  if (!offer.purchasePrice) errors.purchasePrice = "Enter your offer price";
  if (Number.isNaN(offer.initialDeposit)) errors.initialDeposit = "Enter an amount in dollars";
  if (Number.isNaN(offer.balanceDeposit)) errors.balanceDeposit = "Enter an amount in dollars";
  if (!offer.finance) errors.finance = "Choose yes or no";
  if (offer.finance === "yes" && !/^\d{1,3}$/.test(offer.financeDays)) errors.financeDays = "Number of days";
  if (!offer.pestBuilding) errors.pestBuilding = "Choose yes or no";
  if (offer.pestBuilding === "yes" && !/^\d{1,3}$/.test(offer.pestBuildingDays)) errors.pestBuildingDays = "Number of days";
  if (!offer.settlement) errors.settlement = "Choose a settlement period";
  if (offer.settlement === "other" && !offer.settlementOther) errors.settlementOther = "Enter the settlement you'd like";
  if (!offer.signature) errors.signature = "Type your full name to sign";
  if (!offer.agreed) errors.agreed = "Please confirm to submit your offer";

  if (offer.finance !== "yes") offer.financeDays = "";
  if (offer.pestBuilding !== "yes") offer.pestBuildingDays = "";
  if (offer.settlement !== "other") offer.settlementOther = "";
  return { offer, errors };
}

/* Email notification to the agent when an offer arrives, sent through
 * Resend's HTTP API (Railway's Hobby plan blocks outbound SMTP). Uses Node's
 * built-in fetch, so still no dependencies. Disabled unless RESEND_API_KEY and
 * NOTIFY_EMAIL are set; a failed send is logged but never fails the offer.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "";
// Without a verified domain, Resend only allows this sender, and only to the
// Resend account's own email address.
const EMAIL_FROM = process.env.EMAIL_FROM || "Offers <onboarding@resend.dev>";

function escHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtMoney(n) {
  return n || n === 0 ? "$" + Number(n).toLocaleString("en-AU") : "—";
}

function yesNoDays(yn, days) {
  return yn === "yes" ? `Yes — ${days} days` : yn === "no" ? "No" : "—";
}

async function notifyOffer(o) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return;
  const rows = [
    ["Property", o.address],
    ["Buyer/s full names", o.buyerNames],
    ["Email", o.email],
    ["Mobile", o.mobile],
    ["Buyer's solicitor", o.solicitor || "—"],
    ["Purchase price", fmtMoney(o.purchasePrice)],
    ["Initial deposit", fmtMoney(o.initialDeposit) + " — payable when buyer signs a Contract of Sale"],
    ["Balance deposit", fmtMoney(o.balanceDeposit) + (o.balanceDepositPayableOn ? " — payable on " + o.balanceDepositPayableOn : "")],
    ["Subject to finance", yesNoDays(o.finance, o.financeDays)],
    ["Subject to pest & building", yesNoDays(o.pestBuilding, o.pestBuildingDays)],
    ["Settlement", o.settlement === "other" ? o.settlementOther : o.settlement + " days"],
    ["Other terms & conditions", o.otherTerms || "—"],
    ["Agent", o.agent],
    ["Signed (typed name)", o.signature],
    ["Submitted", new Date(o.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", dateStyle: "full", timeStyle: "short" })],
  ];
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;max-width:620px;">
    <h2 style="margin:0 0 4px;">New offer: ${escHTML(fmtMoney(o.purchasePrice))}</h2>
    <p style="margin:0 0 18px;color:#555;">${escHTML(o.address)}</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
      ${rows.map(([k, v]) => `<tr><td style="border-bottom:1px solid #E3E1DC;color:#6E6E6E;width:190px;vertical-align:top;">${escHTML(k)}</td><td style="border-bottom:1px solid #E3E1DC;white-space:pre-wrap;">${escHTML(v)}</td></tr>`).join("")}
    </table>
    <p style="font-size:12px;color:#888;margin-top:18px;">Reply to this email to respond to the buyer directly.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: NOTIFY_EMAIL.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: o.email,
        subject: `New offer ${fmtMoney(o.purchasePrice)} — ${o.address}`,
        html,
      }),
    });
    if (!res.ok) console.error("Offer email failed:", res.status, await res.text());
  } catch (e) {
    console.error("Offer email failed:", e.message);
  }
}

async function handleSubmitOffer(req, res) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  // Two kinds of offer link: a per-property one (/offer/:linkId, address fixed
  // by the agent) and the general one (/offer, buyer types the address).
  const linkId = str(body.linkId, 100);
  const link = linkId
    ? readOfferLink(linkId)
    : { id: null, address: str(body.address, 200), agent: "Adam Sargeant" };
  if (!link) return sendJSON(res, 404, { error: "This offer link is no longer valid" });

  const { offer, errors } = validateOffer(body);
  if (!link.address) errors.address = "Enter the property address";
  if (Object.keys(errors).length) return sendJSON(res, 400, { error: "Please check the highlighted fields", fields: errors });

  const id = `${Date.now().toString(36)}-${randomSuffix()}`;
  const record = {
    id,
    createdAt: new Date().toISOString(),
    linkId: link.id,
    clientId: (currentClient(req) || {}).id || null, // shows in that client's portal
    address: link.address,
    agent: link.agent,
    ...offer,
  };
  fs.writeFile(path.join(OFFERS_DIR, `${id}.json`), JSON.stringify(record), (err) => {
    if (err) return sendJSON(res, 500, { error: "Could not save your offer — please call the agent" });
    sendJSON(res, 200, { ok: true });
    notifyOffer(record);
  });
}

/* ---------------- Off-market ----------------
 * Private listings Adam shares with selected buyers. He manages listings and
 * photos in /admin, and creates one access record per person; each record's
 * id is the secret in their link (/off-market/:id). Revoking = deleting the
 * record. Photos are only served to an admin or a valid access link.
 */

const OM_STATUSES = ["available", "under_offer", "sold", "hidden"];

function readRecord(dir, id) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));
  } catch (e) {
    return null;
  }
}

function writeRecord(dir, record) {
  fs.writeFileSync(path.join(dir, `${record.id}.json`), JSON.stringify(record));
}

function isPhotoName(name) {
  return /^[a-f0-9]{24}\.jpg$/.test(name);
}

function deletePhotos(names) {
  names.filter(isPhotoName).forEach((n) => fs.unlink(path.join(OM_PHOTOS_DIR, n), () => {}));
}

function cleanListing(body) {
  return {
    address: str(body.address, 200),
    suburb: str(body.suburb, 100),
    priceGuide: str(body.priceGuide, 100),
    beds: str(body.beds, 5),
    baths: str(body.baths, 5),
    cars: str(body.cars, 5),
    land: str(body.land, 50),
    description: str(body.description, 5000),
    status: OM_STATUSES.includes(body.status) ? body.status : "available",
    photos: Array.isArray(body.photos) ? body.photos.filter(isPhotoName).slice(0, 40) : [],
  };
}

async function handleSaveListing(req, res, id) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const fields = cleanListing(body);
  if (!fields.address) return sendJSON(res, 400, { error: "Property address is required" });

  const now = new Date().toISOString();
  let record;
  if (id) {
    const existing = readRecord(OM_LISTINGS_DIR, id);
    if (!existing) return sendJSON(res, 404, { error: "Listing not found" });
    deletePhotos(existing.photos.filter((p) => !fields.photos.includes(p)));
    record = { ...existing, ...fields, updatedAt: now };
  } else {
    record = { id: `${slugify(fields.address) || "property"}-${randomSuffix()}`, createdAt: now, updatedAt: now, ...fields };
  }
  writeRecord(OM_LISTINGS_DIR, record);
  sendJSON(res, 200, record);
}

function handleDeleteListing(res, id) {
  const existing = readRecord(OM_LISTINGS_DIR, id);
  if (!existing) return sendJSON(res, 404, { error: "Not found" });
  fs.unlinkSync(path.join(OM_LISTINGS_DIR, `${id}.json`));
  deletePhotos(existing.photos || []);
  sendJSON(res, 200, { ok: true });
}

async function handleUploadPhoto(req, res) {
  let buf;
  try {
    buf = await readRaw(req, MAX_PHOTO_BYTES);
  } catch (e) {
    return sendJSON(res, 413, { error: "Photo is too large" });
  }
  // JPEG magic bytes — the admin page converts every upload to JPEG first.
  if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return sendJSON(res, 400, { error: "Photo must be a JPEG" });
  }
  const name = `${crypto.randomBytes(12).toString("hex")}.jpg`;
  fs.writeFile(path.join(OM_PHOTOS_DIR, name), buf, (err) => {
    if (err) return sendJSON(res, 500, { error: "Could not save photo" });
    sendJSON(res, 200, { name });
  });
}

function handleGetPhoto(req, res, name, token) {
  if (!isPhotoName(name)) return send(res, 404, "Not found");
  if (!isAdmin(req) && !currentClient(req) && !readRecord(OM_ACCESS_DIR, token || "")) return send(res, 403, "Forbidden");
  fs.readFile(path.join(OM_PHOTOS_DIR, name), (err, data) => {
    if (err) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" });
    res.end(data);
  });
}

async function handleCreateAccess(req, res) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const name = str(body.name, 120);
  if (!name) return sendJSON(res, 400, { error: "Enter the person's name" });
  // The id is the secret in their link, so it gets far more randomness than other ids.
  const id = `${slugify(name) || "buyer"}-${crypto.randomBytes(8).toString("hex")}`;
  const record = { id, createdAt: new Date().toISOString(), name, mobile: str(body.mobile, 40), views: 0, lastViewedAt: null };
  writeRecord(OM_ACCESS_DIR, record);
  sendJSON(res, 200, record);
}

function handleViewOffMarket(res, token) {
  const access = readRecord(OM_ACCESS_DIR, token);
  if (!access) return sendJSON(res, 404, { error: "This link is no longer active" });
  access.views = (access.views || 0) + 1;
  access.lastViewedAt = new Date().toISOString();
  writeRecord(OM_ACCESS_DIR, access);

  const order = { available: 0, under_offer: 1, sold: 2 };
  const listings = readJSONDir(OM_LISTINGS_DIR)
    .filter((l) => l.status !== "hidden")
    .sort((a, b) => order[a.status] - order[b.status]); // stable, so newest-first holds within each status
  sendJSON(res, 200, { name: access.name, listings });
}

/* ---------------- Client accounts ----------------
 * Adam creates a client in /admin and texts them an invite link
 * (/set-password/:token). Once they set a password they log in at /login and
 * see /portal: only the appraisals Adam assigned to them, only their own
 * offers, and the off-market properties. There is no public sign-up.
 */

const CLIENTS_DIR = path.join(DATA_DIR, "clients");
fs.mkdirSync(CLIENTS_DIR, { recursive: true });

const CLIENT_COOKIE = "client_session";
const CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const MIN_PASSWORD = 8;

// Signs client session cookies. Persisted under DATA_DIR so sessions survive
// restarts without needing another environment variable.
const SESSION_SECRET = (() => {
  if (process.env.AGENT_SESSION_SECRET) return process.env.AGENT_SESSION_SECRET;
  const file = path.join(DATA_DIR, "session-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch (e) {
    const secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
})();

function normEmail(v) {
  return str(v, 200).toLowerCase();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return safeEqual(test, hash);
}

// The signature covers the password hash, so changing or resetting a
// password logs out every existing session for that client.
function clientSig(client) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(`${client.id}:${client.passwordHash || ""}`).digest("hex");
}

function setClientCookie(req, res, value, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${CLIENT_COOKIE}=${encodeURIComponent(value)}; Path=/adam; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function startClientSession(req, res, client) {
  setClientCookie(req, res, `${client.id}.${clientSig(client)}`, CLIENT_COOKIE_MAX_AGE);
}

function currentClient(req) {
  const raw = parseCookies(req)[CLIENT_COOKIE] || "";
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const client = readRecord(CLIENTS_DIR, raw.slice(0, dot));
  if (!client || !client.passwordHash) return null;
  return safeEqual(raw.slice(dot + 1), clientSig(client)) ? client : null;
}

function findClientByEmail(email) {
  return readJSONDir(CLIENTS_DIR).find((c) => c.email === email) || null;
}

function findClientByInvite(token) {
  if (!/^[a-f0-9]{48}$/.test(token || "")) return null;
  return readJSONDir(CLIENTS_DIR).find((c) => c.inviteToken && safeEqual(c.inviteToken, token)) || null;
}

// What the admin page sees - never the password hash.
function publicClient(c) {
  return {
    id: c.id,
    createdAt: c.createdAt,
    name: c.name,
    email: c.email,
    mobile: c.mobile,
    appraisalIds: c.appraisalIds || [],
    active: !!c.passwordHash,
    inviteToken: c.inviteToken || null,
    lastLoginAt: c.lastLoginAt || null,
  };
}

function newInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

function cleanAppraisalIds(ids) {
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && /^[a-z0-9-]+$/i.test(id)).slice(0, 50) : [];
}

async function handleCreateClient(req, res) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const name = str(body.name, 120);
  const email = normEmail(body.email);
  if (!name) return sendJSON(res, 400, { error: "Enter the client's name" });
  if (!isEmail(email)) return sendJSON(res, 400, { error: "Enter a valid email — it's their login" });
  if (findClientByEmail(email)) return sendJSON(res, 400, { error: "A client with that email already exists" });
  const record = {
    id: `${slugify(name) || "client"}-${randomSuffix()}`,
    createdAt: new Date().toISOString(),
    name,
    email,
    mobile: str(body.mobile, 40),
    appraisalIds: cleanAppraisalIds(body.appraisalIds),
    passwordHash: null,
    inviteToken: newInviteToken(),
    lastLoginAt: null,
  };
  writeRecord(CLIENTS_DIR, record);
  sendJSON(res, 200, publicClient(record));
}

async function handleUpdateClient(req, res, id) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const client = readRecord(CLIENTS_DIR, id);
  if (!client) return sendJSON(res, 404, { error: "Client not found" });
  if (body.name !== undefined) {
    const name = str(body.name, 120);
    if (!name) return sendJSON(res, 400, { error: "Enter the client's name" });
    client.name = name;
  }
  if (body.email !== undefined) {
    const email = normEmail(body.email);
    if (!isEmail(email)) return sendJSON(res, 400, { error: "Enter a valid email" });
    const other = findClientByEmail(email);
    if (other && other.id !== id) return sendJSON(res, 400, { error: "Another client already uses that email" });
    client.email = email;
  }
  if (body.mobile !== undefined) client.mobile = str(body.mobile, 40);
  if (body.appraisalIds !== undefined) client.appraisalIds = cleanAppraisalIds(body.appraisalIds);
  writeRecord(CLIENTS_DIR, client);
  sendJSON(res, 200, publicClient(client));
}

// New invite/reset link. Doesn't touch the current password until it's used.
function handleReissueInvite(res, id) {
  const client = readRecord(CLIENTS_DIR, id);
  if (!client) return sendJSON(res, 404, { error: "Client not found" });
  client.inviteToken = newInviteToken();
  writeRecord(CLIENTS_DIR, client);
  sendJSON(res, 200, publicClient(client));
}

function handleGetInvite(res, token) {
  const client = findClientByInvite(token);
  if (!client) return sendJSON(res, 404, { error: "This link has expired or already been used" });
  sendJSON(res, 200, { name: client.name, email: client.email, reset: !!client.passwordHash });
}

async function handleSetPassword(req, res) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const client = findClientByInvite(str(body.token, 100));
  if (!client) return sendJSON(res, 404, { error: "This link has expired or already been used — ask Adam for a new one" });
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD) return sendJSON(res, 400, { error: `Use at least ${MIN_PASSWORD} characters` });
  client.passwordHash = hashPassword(password);
  client.inviteToken = null;
  client.lastLoginAt = new Date().toISOString();
  writeRecord(CLIENTS_DIR, client);
  startClientSession(req, res, client);
  sendJSON(res, 200, { ok: true });
}

// Simple brute-force brake: 10 failed attempts per email per 15 minutes.
const loginFailures = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function tooManyFailures(email) {
  const f = loginFailures.get(email);
  if (!f || Date.now() - f.first > LOGIN_WINDOW_MS) return false;
  return f.count >= 10;
}

function noteFailure(email) {
  const f = loginFailures.get(email);
  if (!f || Date.now() - f.first > LOGIN_WINDOW_MS) loginFailures.set(email, { first: Date.now(), count: 1 });
  else f.count += 1;
}

async function handleClientLogin(req, res) {
  const body = await readJSONBody(req, res);
  if (!body) return;
  const email = normEmail(body.email);
  if (tooManyFailures(email)) return sendJSON(res, 429, { error: "Too many attempts — please wait 15 minutes or call Adam" });
  const client = email && findClientByEmail(email);
  if (!client || !checkPassword(body.password, client.passwordHash)) {
    noteFailure(email);
    return sendJSON(res, 401, { error: "Email or password is incorrect" });
  }
  loginFailures.delete(email);
  client.lastLoginAt = new Date().toISOString();
  writeRecord(CLIENTS_DIR, client);
  startClientSession(req, res, client);
  sendJSON(res, 200, { ok: true });
}

// Everything a logged-in client may see: only their own appraisals and
// offers, plus the off-market properties (hidden drafts excluded).
function handlePortal(req, res) {
  const client = currentClient(req);
  if (!client) return sendJSON(res, 401, { error: "Please log in" });

  const appraisals = (client.appraisalIds || [])
    .map((id) => readRecord(APPRAISALS_DIR, id))
    .filter(Boolean)
    .map((a) => ({ id: a.id, address: a.address, createdAt: a.createdAt }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const offers = readJSONDir(OFFERS_DIR)
    .filter((o) => o.clientId === client.id || (o.email || "").toLowerCase() === client.email)
    .map((o) => ({
      id: o.id, createdAt: o.createdAt, address: o.address, purchasePrice: o.purchasePrice,
      initialDeposit: o.initialDeposit, balanceDeposit: o.balanceDeposit, balanceDepositPayableOn: o.balanceDepositPayableOn,
      finance: o.finance, financeDays: o.financeDays, pestBuilding: o.pestBuilding, pestBuildingDays: o.pestBuildingDays,
      settlement: o.settlement, settlementOther: o.settlementOther, otherTerms: o.otherTerms,
    }));

  const order = { available: 0, under_offer: 1, sold: 2 };
  const offMarket = readJSONDir(OM_LISTINGS_DIR)
    .filter((l) => l.status !== "hidden")
    .sort((a, b) => order[a.status] - order[b.status]);

  sendJSON(res, 200, { name: client.name, email: client.email, appraisals, offers, offMarket });
}

// Admin delete for any stored record. The id pattern keeps the path inside dir.
function handleDelete(res, dir, id) {
  if (!/^[a-z0-9-]+$/i.test(id)) return sendJSON(res, 400, { error: "Invalid id" });
  fs.unlink(path.join(dir, `${id}.json`), (err) => {
    if (err) return sendJSON(res, 404, { error: "Not found" });
    sendJSON(res, 200, { ok: true });
  });
}

const DELETABLE = { appraisals: APPRAISALS_DIR, offers: OFFERS_DIR, "offer-links": OFFER_LINKS_DIR, "off-market/access": OM_ACCESS_DIR, clients: CLIENTS_DIR };

// Mounted with app.use("/adam", ...), so req.url arrives with /adam stripped.
module.exports = function handleAgent(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/health") return send(res, 200, "ok");

  if (pathname === "/api/appraisals" && req.method === "POST") {
    return handleSaveAppraisal(req, res);
  }
  if (pathname === "/api/admin/login" && req.method === "POST") {
    return handleAdminLogin(req, res);
  }
  if (pathname === "/api/admin/logout" && req.method === "POST") {
    setAdminCookie(req, res, "", 0);
    return sendJSON(res, 200, { ok: true });
  }
  if (pathname === "/api/admin/me" && req.method === "GET") {
    return sendJSON(res, 200, { admin: isAdmin(req), configured: !!ADMIN_PASSWORD });
  }

  const deleteMatch = pathname.match(/^\/api\/(appraisals|offers|offer-links|off-market\/access|clients)\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return handleDelete(res, DELETABLE[deleteMatch[1]], deleteMatch[2]);
  }

  // Client accounts. Admin manages them; clients only reach their own portal.
  if (pathname === "/api/clients" && req.method === "GET") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return sendJSON(res, 200, readJSONDir(CLIENTS_DIR).map(publicClient));
  }
  if (pathname === "/api/clients" && req.method === "POST") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return handleCreateClient(req, res);
  }
  const clientMatch = pathname.match(/^\/api\/clients\/([a-z0-9-]+)(\/invite)?$/i);
  if (clientMatch && req.method === "POST" && clientMatch[2]) {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return handleReissueInvite(res, clientMatch[1]);
  }
  if (clientMatch && req.method === "PUT" && !clientMatch[2]) {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return handleUpdateClient(req, res, clientMatch[1]);
  }
  const inviteMatch = pathname.match(/^\/api\/client\/invite\/([a-f0-9]+)$/);
  if (inviteMatch && req.method === "GET") return handleGetInvite(res, inviteMatch[1]);
  if (pathname === "/api/client/set-password" && req.method === "POST") return handleSetPassword(req, res);
  if (pathname === "/api/client/login" && req.method === "POST") return handleClientLogin(req, res);
  if (pathname === "/api/client/logout" && req.method === "POST") {
    setClientCookie(req, res, "", 0);
    return sendJSON(res, 200, { ok: true });
  }
  if (pathname === "/api/client/me" && req.method === "GET") {
    const c = currentClient(req);
    return sendJSON(res, 200, { client: c ? { name: c.name, email: c.email, mobile: c.mobile } : null });
  }
  if (pathname === "/api/client/portal" && req.method === "GET") return handlePortal(req, res);
  if (pathname === "/login" || pathname === "/login/") pathname = "/login.html";
  if (/^\/set-password\/[a-f0-9]+$/.test(pathname)) pathname = "/set-password.html";
  if (pathname === "/portal" || pathname === "/portal/") pathname = "/portal.html";

  // Offer links + offers. Creating links and reading offers is admin-only;
  // buyers can only look up a single link and submit an offer against it.
  if (pathname === "/api/offer-links" && req.method === "POST") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return handleCreateOfferLink(req, res);
  }
  if (pathname === "/api/offer-links" && req.method === "GET") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return sendJSON(res, 200, readJSONDir(OFFER_LINKS_DIR));
  }
  const linkMatch = pathname.match(/^\/api\/offer-links\/([a-z0-9-]+)$/i);
  if (linkMatch && req.method === "GET") {
    const link = readOfferLink(linkMatch[1]);
    if (!link) return sendJSON(res, 404, { error: "Not found" });
    return sendJSON(res, 200, { id: link.id, address: link.address, agent: link.agent });
  }
  if (pathname === "/api/offers" && req.method === "POST") {
    return handleSubmitOffer(req, res);
  }
  if (pathname === "/api/offers" && req.method === "GET") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return sendJSON(res, 200, readJSONDir(OFFERS_DIR));
  }
  if (pathname === "/offer" || /^\/offer\/[a-z0-9-]+$/i.test(pathname)) {
    pathname = "/offer.html";
  }

  // Off-market: listings, photos and access links are admin-managed; buyers
  // only reach /api/off-market/view/:token and photos via their token.
  if (pathname.startsWith("/api/off-market/")) {
    const viewMatch = pathname.match(/^\/api\/off-market\/view\/([a-z0-9-]+)$/i);
    if (viewMatch && req.method === "GET") return handleViewOffMarket(res, viewMatch[1]);
    const photoMatch = pathname.match(/^\/api\/off-market\/photos\/([^/]+)$/);
    if (photoMatch && req.method === "GET") return handleGetPhoto(req, res, photoMatch[1], url.searchParams.get("t"));

    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    if (pathname === "/api/off-market/listings" && req.method === "GET") return sendJSON(res, 200, readJSONDir(OM_LISTINGS_DIR));
    if (pathname === "/api/off-market/listings" && req.method === "POST") return handleSaveListing(req, res, null);
    const listingMatch = pathname.match(/^\/api\/off-market\/listings\/([a-z0-9-]+)$/i);
    if (listingMatch && req.method === "PUT") return handleSaveListing(req, res, listingMatch[1]);
    if (listingMatch && req.method === "DELETE") return handleDeleteListing(res, listingMatch[1]);
    if (pathname === "/api/off-market/photos" && req.method === "POST") return handleUploadPhoto(req, res);
    if (pathname === "/api/off-market/access" && req.method === "GET") return sendJSON(res, 200, readJSONDir(OM_ACCESS_DIR));
    if (pathname === "/api/off-market/access" && req.method === "POST") return handleCreateAccess(req, res);
    return sendJSON(res, 404, { error: "Not found" });
  }
  if (/^\/off-market\/[a-z0-9-]+$/i.test(pathname)) {
    pathname = "/off-market.html";
  }

  // The list exposes every client's name and address, so it's admin-only.
  // Individual appraisals (/api/appraisals/:id) stay public — the unguessable
  // id in the link is what the client uses to open it.
  if (pathname === "/api/appraisals" && req.method === "GET") {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: "Admin login required" });
    return handleListAppraisals(req, res);
  }
  const apiMatch = pathname.match(/^\/api\/appraisals\/([a-z0-9-]+)$/i);
  if (apiMatch && req.method === "GET") {
    return handleGetAppraisal(req, res, apiMatch[1]);
  }

  // Short appraisal links (/a/:id) serve the same static page; client-side JS
  // detects the /a/ path and fetches the data from the API above.
  if (/^\/a\/[a-z0-9-]+$/i.test(pathname)) {
    pathname = "/appraisal-tool.html";
  }

  // Home is the agent profile page; the builder lives at /appraisal-tool.html.
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin.html";

  // Resolve within PUBLIC_DIR only — no path traversal outside it.
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
};
