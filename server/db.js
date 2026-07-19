const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function ensureSchema() {
  const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}

module.exports = {
  pool,
  ensureSchema,
  query: (text, params) => pool.query(text, params),
};
