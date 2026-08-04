const crypto = require("crypto");
const { query } = require("../db");

const SESSION_COOKIE = "connector_session";
const SESSION_DAYS = 180;

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

async function createSession(buyerId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    "INSERT INTO buyer_sessions (buyer_id, token, expires_at) VALUES ($1, $2, $3)",
    [buyerId, token, expiresAt]
  );
  return { token, expiresAt };
}

function setSessionCookie(res, token, expiresAt) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function requireBuyer(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: "Not signed in" });

  try {
    const result = await query(
      `SELECT b.* FROM buyer_sessions s
       JOIN buyers b ON b.id = s.buyer_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (!result.rows.length) return res.status(401).json({ error: "Session expired" });
    req.buyer = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createSession, setSessionCookie, requireBuyer, parseCookies, SESSION_COOKIE };
