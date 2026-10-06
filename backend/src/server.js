require('dotenv').config();

const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Check the database connection when the server starts
  try {
    await db.query('SELECT 1');
    console.log('Database connected');
  } catch (err) {
    console.error('Database connection FAILED:', err.message);
  }
});