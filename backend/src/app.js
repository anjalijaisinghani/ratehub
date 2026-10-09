require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/security');
const routes = require('./routes');
const { generalLimiter } = require('./middleware/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Needed to see the real client IP when running behind a proxy/load balancer
app.set('trust proxy', config.trustProxy);

// Security headers (no X-Powered-By, nosniff, frame protection, HSTS on HTTPS, ...)
app.use(helmet());

// Only OUR website may call this API from a browser, and it may send cookies
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = Postman, curl, tests, server-to-server: allowed
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      callback(null, false); // browser gets no CORS headers, so it blocks the response
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' })); // reject huge request bodies
app.use(cookieParser());

// Simple health check (a database check comes in a later milestone)
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

app.use('/api', generalLimiter);

// Versioned API. The old /api paths still work while we migrate.
app.use('/api/v1', routes);
app.use('/api', routes); // legacy: will be removed in Milestone 15

app.use(notFoundHandler); // must be after all routes
app.use(errorHandler);    // must be last

module.exports = app;