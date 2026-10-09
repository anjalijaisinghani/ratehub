require('dotenv').config({ quiet: true });

const { assertSecureConfig } = require('./config/security');
assertSecureConfig(); // stop immediately if the secret is missing or unsafe

const app = require('./app');
const db = require('./config/db');
const cleanupTokens = require('./jobs/cleanupTokens');

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Check the database connection when the server starts
  try {
    await db.query('SELECT 1');
    console.log('Database connected');
    cleanupTokens.start();
  } catch (err) {
    console.error('Database connection FAILED:', err.message);
  }
});