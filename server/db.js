const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function insertEnquiry({ fullName, email, phone, message }) {
  const { rows } = await pool.query(
    `INSERT INTO enquiries (full_name, email, phone, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [fullName, email, phone, message]
  );
  return rows[0];
}

module.exports = { pool, ensureSchema, insertEnquiry };
