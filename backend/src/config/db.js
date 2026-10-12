const mysql = require('mysql2/promise');

// A "pool" keeps several connections ready, so queries are fast
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Dates are stored and read as UTC. The browser shows them in the viewer's own timezone.
   timezone: 'Z',
  // Emoji and non-English text need the 4-byte UTF-8 character set
  charset: 'utf8mb4_unicode_ci',
});

module.exports = pool;