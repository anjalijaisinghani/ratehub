require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' })); // reject huge request bodies

// Simple health check (a database check comes in a later milestone)
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Versioned API. The old /api paths still work while we migrate.
app.use('/api/v1', routes);
app.use('/api', routes); // legacy: will be removed in Milestone 15

app.use(notFoundHandler); // must be after all routes
app.use(errorHandler);    // must be last

module.exports = app;