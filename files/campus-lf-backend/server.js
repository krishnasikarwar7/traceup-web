/**
 * server.js
 *
 * Entry point for the Campus Lost & Found Portal API.
 *
 * Responsibilities:
 *   - Load environment variables
 *   - Configure Express (CORS, JSON parsing, static files)
 *   - Mount all route handlers
 *   - Global error handler
 *   - Start HTTP server
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

// ── Import route modules ──────────────────────────────────────
const authRoutes  = require('./routes/authRoutes');
const itemRoutes  = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Ensure uploads directory exists ──────────────────────────
const UPLOAD_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════════
//  GLOBAL MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// CORS — allow requests from the frontend origin
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
  ],
  methods:            ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:     ['Content-Type', 'Authorization'],
  exposedHeaders:     ['Content-Range', 'X-Total-Count'],
  credentials:        true,
  optionsSuccessStatus: 200,
}));

// Parse incoming JSON bodies (up to 10 MB for base64 data)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded form bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images as static files
// e.g. GET /uploads/item-1234567890-abc123.jpg
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge:    '7d',    // cache uploaded images for 7 days
  immutable: false,
}));

// Request logger (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString().slice(11, 19)}  ${req.method.padEnd(7)} ${req.path}`);
    next();
  });
}

// ═══════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════

app.use('/api/auth',  authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims',claimRoutes);
app.use('/api/admin', adminRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success:   true,
    message:   'Campus Lost & Found API is running.',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
});

// ── 404 — unknown API routes ──────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error:   `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// ═══════════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
//  Must have 4 parameters for Express to treat it as error middleware
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log full stack in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('\n--- Error ---');
    console.error(err.stack || err);
    console.error('-------------\n');
  }

  // MySQL duplicate entry error
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error:   'A record with this value already exists.',
    });
  }

  // MySQL foreign key constraint error
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error:   'Referenced record does not exist.',
    });
  }

  // Multer errors bubble up here if not caught in uploadMiddleware
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, error: err.message });
  }

  // JWT errors (shouldn't reach here normally — caught in authMiddleware)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  // Generic server error
  const status  = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred.'
    : (err.message || 'Internal server error');

  res.status(status).json({ success: false, error: message });
});

// ═══════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║   Campus Lost & Found API                    ║`);
  console.log(`║   http://localhost:${PORT}                       ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  POST   /api/auth/register                   ║');
  console.log('║  POST   /api/auth/login                      ║');
  console.log('║  GET    /api/auth/profile      [protected]   ║');
  console.log('║  GET    /api/items             [public]      ║');
  console.log('║  GET    /api/items/stats       [public]      ║');
  console.log('║  POST   /api/items             [protected]   ║');
  console.log('║  GET    /api/items/:id         [public]      ║');
  console.log('║  PUT    /api/items/:id         [protected]   ║');
  console.log('║  DELETE /api/items/:id         [protected]   ║');
  console.log('║  POST   /api/claims            [protected]   ║');
  console.log('║  GET    /api/claims/user        [protected]  ║');
  console.log('║  GET    /api/admin/stats       [admin]       ║');
  console.log('║  GET    /api/admin/items       [admin]       ║');
  console.log('║  GET    /api/admin/claims      [admin]       ║');
  console.log('║  PUT    /api/admin/claims/:id/approve [admin]║');
  console.log('║  PUT    /api/admin/claims/:id/reject  [admin]║');
  console.log('║  PUT    /api/admin/items/:id/return   [admin]║');
  console.log('║  GET    /api/admin/users       [admin]       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Seed credentials:                           ║');
  console.log('║  admin@university.edu  /  admin123           ║');
  console.log('║  priya@university.edu  /  pass1234           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});

module.exports = app;
