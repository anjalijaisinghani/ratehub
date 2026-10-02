// Load variables from the .env file (must be first)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');

const storeRoutes = require('./routes/storeRoutes');

const ownerRoutes = require('./routes/ownerRoutes');

const adminRoutes = require('./routes/adminRoutes');
const app = express();

// Middleware
app.use(cors());           // allow the React app to call this server
app.use(express.json());   // allow reading JSON from request bodies




// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/owner', ownerRoutes);


// Test route: checks that the server works
app.get('/', (req, res) => {
  res.json({ message: 'Store Rating API is running' });
});



// Unknown URL -> clean JSON instead of an HTML error page
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Catches any error that wasn't handled (including a broken JSON body)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  res.status(500).json({ message: 'Something went wrong' });
});

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