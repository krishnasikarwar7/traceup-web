/**
 * middleware/authMiddleware.js
 *
 * Verifies the JWT Bearer token sent in the Authorization header.
 * Attaches the decoded user payload to req.user so downstream
 * controllers know who is making the request.
 *
 * Usage:
 *   router.get('/protected', protect, controller.method);
 */

'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Require a valid JWT. Rejects with 401 if missing or invalid.
 */
const protect = async (req, res, next) => {
  try {
    // ── 1. Extract token from header ─────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error:   'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"

    // ── 2. Verify signature + expiry ──────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Token has expired. Please log in again.'
        : 'Invalid token. Please log in again.';
      return res.status(401).json({ success: false, error: message });
    }

    // ── 3. Load user from DB (ensures account still exists) ───
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error:   'User no longer exists.',
      });
    }

    // ── 4. Attach to request ──────────────────────────────────
    req.user = user; // { id, name, email, role, department, ... }
    next();

  } catch (err) {
    next(err); // pass to global error handler
  }
};

module.exports = { protect };
