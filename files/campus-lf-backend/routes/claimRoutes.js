/**
 * routes/claimRoutes.js
 *
 * Protected (JWT required):
 *   POST /api/claims              — submit a claim for an item
 *   GET  /api/claims/user         — get claims submitted by logged-in user
 *   GET  /api/claims/item/:itemId — get all claims for an item (owner or admin)
 */

'use strict';

const express          = require('express');
const { body }         = require('express-validator');
const claimController  = require('../controllers/claimController');
const { protect }      = require('../middleware/authMiddleware');

const router = express.Router();

// ── Validation rules ──────────────────────────────────────────
const claimValidation = [
  body('item_id')
    .notEmpty().withMessage('item_id is required.')
    .isInt({ min: 1 }).withMessage('item_id must be a positive integer.')
    .toInt(),
  body('message')
    .trim().notEmpty().withMessage('A claim description (message) is required.')
    .isLength({ min: 20, max: 2000 })
    .withMessage('Message must be 20–2000 characters. Please be descriptive to help verify ownership.'),
  body('contact')
    .optional().trim()
    .isLength({ max: 100 }).withMessage('Contact info must be under 100 characters.'),
];

// ── Routes ────────────────────────────────────────────────────

// All claim routes require authentication
router.use(protect);

router.post('/',              claimValidation, claimController.createClaim);
router.get( '/user',                          claimController.getUserClaims);
router.get( '/item/:itemId',                  claimController.getItemClaims);

module.exports = router;
