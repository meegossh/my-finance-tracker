/// <reference types="node" />
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Runs a query under the context of a user_id, which enables Postgres RLS
 */
export async function queryWithUser(userId: string, text: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    await client.query('SET app.current_user_id = $1', [userId]);
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

export default pool;
