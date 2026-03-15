/**
 * routes/adminRoutes.js
 *
 * All routes here require: protect + adminOnly middleware.
 *
 *   GET    /api/admin/stats               — dashboard statistics
 *   GET    /api/admin/items               — all items (with filters)
 *   PUT    /api/admin/items/:id/status    — change item status
 *   PUT    /api/admin/items/:id/return    — mark item as returned
 *   DELETE /api/admin/items/:id           — delete any item
 *   GET    /api/admin/claims              — all claims
 *   PUT    /api/admin/claims/:id/approve  — approve a claim
 *   PUT    /api/admin/claims/:id/reject   — reject a claim
 *   GET    /api/admin/users               — all registered users
 */

'use strict';

const express          = require('express');
const adminController  = require('../controllers/adminController');
const { protect }      = require('../middleware/authMiddleware');
const { adminOnly }    = require('../middleware/adminMiddleware');

const router = express.Router();

// ── Apply auth + admin check to every route in this file ──────
router.use(protect, adminOnly);

// ── Dashboard stats ───────────────────────────────────────────
router.get('/stats', adminController.getStats);

// ── Items ─────────────────────────────────────────────────────
router.get(   '/items',                adminController.getAllItems);
router.put(   '/items/:id/status',     adminController.updateItemStatus);
router.put(   '/items/:id/return',     adminController.markItemReturned);
router.delete('/items/:id',            adminController.deleteItem);

// ── Claims ────────────────────────────────────────────────────
router.get('/claims',                  adminController.getAllClaims);
router.put('/claims/:id/approve',      adminController.approveClaim);
router.put('/claims/:id/reject',       adminController.rejectClaim);

// ── Users ─────────────────────────────────────────────────────
router.get('/users',                   adminController.getAllUsers);

module.exports = router;
