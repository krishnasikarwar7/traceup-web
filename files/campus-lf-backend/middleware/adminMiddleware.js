/**
 * middleware/adminMiddleware.js
 *
 * Role-based access control. Must be used AFTER `protect` middleware
 * because it relies on req.user being set.
 *
 * Usage:
 *   router.get('/admin/only', protect, adminOnly, controller.method);
 */

'use strict';

/**
 * Allow only users with role === 'admin'.
 * Returns 403 Forbidden for everyone else.
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    // Should never happen if protect runs first, but guard anyway
    return res.status(401).json({
      success: false,
      error:   'Not authenticated.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error:   'Access denied. Admin role required.',
    });
  }

  next();
};

/**
 * Allow admins OR the resource owner.
 * Requires req.user and req.resourceOwnerId (set by controller before calling next).
 *
 * Example:
 *   req.resourceOwnerId = item.user_id;
 *   adminOrOwner(req, res, next);
 */
const adminOrOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner = req.resourceOwnerId && req.resourceOwnerId === req.user.id;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({
      success: false,
      error:   'Access denied. You do not have permission to modify this resource.',
    });
  }

  next();
};

module.exports = { adminOnly, adminOrOwner };
