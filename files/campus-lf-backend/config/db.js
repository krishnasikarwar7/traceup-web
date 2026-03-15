/**
 * config/db.js
 *
 * MySQL connection pool using mysql2/promise.
 * We use a connection pool (not a single connection) so multiple
 * requests can be handled concurrently without blocking each other.
 *
 * Usage:
 *   const pool = require('./config/db');
 *   const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
 */

'use strict';

const mysql  = require('mysql2/promise');
require('dotenv').config();

// ── Pool configuration ──────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'campus_lost_found',
  waitForConnections: true,   // queue requests when all connections are busy
  connectionLimit:    10,     // max simultaneous connections in the pool
  queueLimit:         0,      // unlimited request queue (0 = no limit)
  timezone:           'Z',    // store/retrieve dates in UTC
  charset:            'utf8mb4',
  // Return JS Date objects for DATETIME columns
  dateStrings:        false,
});

// ── Verify connection on startup ────────────────────────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ MySQL connected → ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check your .env DB_* variables and that MySQL is running.');
    process.exit(1); // crash fast so the developer sees the error immediately
  }
})();

module.exports = pool;
