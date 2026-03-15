/**
 * server.js
 *
 * Entry point for the TraceUp API.
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
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config({ path: path.join(__dirname, 'files', '.env') });

// Initialize Supabase client (validates env vars on import)
require('./files/config/db');

// ── Import route modules ──────────────────────────────────────
const authRoutes  = require('./files/routes/authRoutes');
const itemRoutes  = require('./files/routes/itemRoutes');
const claimRoutes = require('./files/routes/claimRoutes');
const adminRoutes = require('./files/routes/adminRoutes');
const chatRoutes  = require('./files/routes/chatRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = 'campus_lf_super_secret_jwt_key_change_this_in_production_2024';
const normalizeOrigin = (value = '') => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return '';
  }
};
const parseOrigins = (value = '') =>
  value
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
const envOrigins = parseOrigins(process.env.FRONTEND_URL || '');
const inferredOrigins = [
  process.env.RENDER_EXTERNAL_URL,
  process.env.RAILWAY_STATIC_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
  process.env.PUBLIC_URL,
  process.env.APP_URL,
].map(normalizeOrigin).filter(Boolean);
const configuredOrigins = [...new Set([...envOrigins, ...inferredOrigins])];
const localOrigins = [
  'http://localhost:5500',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
];
const allowedOrigins = [...new Set(isProduction ? configuredOrigins : [...configuredOrigins, ...localOrigins])];

if (isProduction) {
  if (!envOrigins.length) {
    console.warn('[startup] FRONTEND_URL is not set. Falling back to auto-detected platform origins:', allowedOrigins.length ? allowedOrigins.join(', ') : '(none)');
  }
  const hasStrongJwt =
    !!process.env.JWT_SECRET &&
    process.env.JWT_SECRET !== DEFAULT_JWT_SECRET &&
    process.env.JWT_SECRET.length >= 32;

  if (!hasStrongJwt) {
    const fallbackFromSupabase =
      process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_KEY.length >= 32
        ? process.env.SUPABASE_SERVICE_KEY
        : '';
    if (fallbackFromSupabase) {
      process.env.JWT_SECRET = fallbackFromSupabase;
      console.warn('[startup] JWT_SECRET is missing/weak. Using SUPABASE_SERVICE_KEY as fallback. Set a dedicated JWT_SECRET in production env.');
    } else {
      process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
      console.warn('[startup] JWT_SECRET is missing/weak and no strong fallback found. Using an ephemeral secret for this process only. Set JWT_SECRET immediately.');
    }
  }
}

// ── Ensure uploads directory exists ──────────────────────────
const UPLOAD_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
const LEGACY_UPLOAD_DIR = path.join(__dirname, 'files', process.env.UPLOAD_DIR || 'uploads');
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.warn('Could not create UPLOAD_DIR:', err.message);
}

// ═══════════════════════════════════════════════════════════════
//  GLOBAL MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

// CORS — allow requests from the frontend origin
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
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
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge:    '7d',
  immutable: false,
}));
// Backward compatibility: older uploads were stored under files/uploads
if (LEGACY_UPLOAD_DIR !== UPLOAD_DIR && fs.existsSync(LEGACY_UPLOAD_DIR)) {
  app.use('/uploads', express.static(LEGACY_UPLOAD_DIR, {
    maxAge:    '7d',
    immutable: false,
  }));
}

const PUBLIC_DIR = path.join(__dirname, 'files', 'public');

// Serve frontend static files
app.use(express.static(PUBLIC_DIR));


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
app.use('/api/chat',  chatRoutes);

// Pretty frontend routes
app.get('/chat/:conversationId', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'chat.html'));
});
app.get('/admin/chats', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin-chats.html'));
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success:   true,
    message:   'TraceUp API is running.',
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
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log full stack in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('\n--- Error ---');
    console.error(err.stack || err);
    console.error('-------------\n');
  }

  // Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, error: err.message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  // Supabase / PostgreSQL unique constraint
  if (err.message && err.message.includes('duplicate key')) {
    return res.status(409).json({
      success: false,
      error:   'A record with this value already exists.',
    });
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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   TraceUp API  (Supabase)                    ║');
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
    console.log('║  GET    /api/claims/user       [protected]   ║');
    console.log('║  GET    /api/chat/my           [protected]   ║');
    console.log('║  GET    /api/chat/conversations/:id/messages ║');
    console.log('║  POST   /api/chat/conversations/:id/messages ║');
    console.log('║  GET    /api/admin/stats       [admin]       ║');
    console.log('║  GET    /api/admin/items       [admin]       ║');
    console.log('║  GET    /api/admin/claims      [admin]       ║');
    console.log('║  PUT    /api/admin/claims/:id/approve [admin]║');
    console.log('║  PUT    /api/admin/claims/:id/reject  [admin]║');
    console.log('║  PUT    /api/admin/items/:id/return   [admin]║');
    console.log('║  GET    /api/admin/users       [admin]       ║');
    console.log('║  GET    /api/admin/chats       [admin]       ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Seed credentials:                           ║');
    console.log('║  admin@university.edu  /  admin123           ║');
    console.log('║  alex@university.edu   /  pass1234           ║');
    console.log('╚══════════════════════════════════════════════╝\n');
  });
}

module.exports = app;
