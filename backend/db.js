import pkg from "pg";
const { Pool } = pkg;

// Supabase ka connection string env se aayega
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default pool;
