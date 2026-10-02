// Creates the default admin account (safe to run more than once)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

const ADMIN = {
  name: 'System Administrator Account',
  email: 'admin@example.com',
  password: 'Admin@123',
  address: 'Head Office, Main Street, Mumbai, India',
};

async function seed() {
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN.email]);

    if (rows.length > 0) {
      console.log('Admin already exists. Nothing to do.');
    } else {
      const hash = await bcrypt.hash(ADMIN.password, 10);
      await db.query(
        'INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, ?)',
        [ADMIN.name, ADMIN.email, hash, ADMIN.address, 'ADMIN']
      );
      console.log(`Admin created: ${ADMIN.email} / ${ADMIN.password}`);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await db.end(); // close the connection so the script can exit
  }
}

seed();