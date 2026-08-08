function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  const expected = process.env.CRM_ADMIN_KEY;

  if (!expected) {
    return res.status(500).json({ error: "CRM_ADMIN_KEY is not configured on the server" });
  }
  if (!key || key !== expected) {
    return res.status(401).json({ error: "Invalid admin key" });
  }
  next();
}

module.exports = { requireAdmin };
