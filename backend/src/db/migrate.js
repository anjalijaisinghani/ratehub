const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// Applies every migration file that has not been applied yet, in filename order.
const runMigrations = async ({ log = console.log } = {}) => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true, // only this tool allows several statements per query
      timezone: 'Z',
    });
  } catch (err) {
    throw new Error(
      `Cannot connect to database "${process.env.DB_NAME}" at ${process.env.DB_HOST}:${process.env.DB_PORT}. ` +
        `Is Docker running (docker compose ps)? Details: ${err.message}`
    );
  }

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    const applied = [];

    for (const file of files) {
      if (done.has(file)) continue;
      log(`Applying ${file} ...`);
      await conn.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      applied.push(file);
    }

    log(applied.length ? `Done. Applied ${applied.length} migration(s).` : 'Database is already up to date.');
    return applied;
  } finally {
    await conn.end();
  }
};

// Runs when you type: npm run migrate
if (require.main === module) {
  require('dotenv').config();
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };