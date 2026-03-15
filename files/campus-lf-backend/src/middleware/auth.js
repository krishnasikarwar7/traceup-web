/**
 * auth.js — JWT authentication middleware
 */

const { verifyJwt }         = require('../utils/crypto');
const { unauthorized, forbidden } = require('../utils/response');
const { Users }             = require('../db/database');

/**
 * authenticate — verifies JWT from Authorization header.
 * Attaches req.user on success.
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return unauthorized(res, 'No token provided. Please log in.');

  const payload = verifyJwt(token);
  if (!payload)  return unauthorized(res, 'Invalid or expired token. Please log in again.');

  const user = Users.findById(payload.userId);
  if (!user)     return unauthorized(res, 'User no longer exists.');

  req.user = Users.safe(user);
  next();
}

/**
 * requireRole(...roles) — role-based access guard.
 * Must be used AFTER authenticate.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!roles.includes(req.user.role)) {
      return forbidden(res, `Requires role: ${roles.join(' or ')}`);
    }
    next();
  };
}

const requireAdmin = requireRole('admin');

/**
 * optionalAuth — attaches req.user if token present, but never blocks.
 */
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const payload = verifyJwt(token);
    if (payload) {
      const user = Users.findById(payload.userId);
      if (user) req.user = Users.safe(user);
    }
  }
  next();
}

module.exports = { authenticate, requireRole, requireAdmin, optionalAuth };
