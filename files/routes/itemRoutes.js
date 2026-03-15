/**
 * routes/itemRoutes.js
 *
 * Public:
 *   GET  /api/items          — list with filters
 *   GET  /api/items/stats    — dashboard stat counts
 *   GET  /api/items/:id      — single item detail
 *
 * Protected (JWT required):
 *   GET  /api/items/my       — items reported by logged-in user
 *   POST /api/items          — report new lost/found item (with image upload)
 *   PUT  /api/items/:id      — edit item (owner or admin)
 *   DELETE /api/items/:id    — delete item (owner or admin)
 */

'use strict';

const express         = require('express');
const { body }        = require('express-validator');
const itemController  = require('../controllers/itemController');
const { protect }     = require('../middleware/authMiddleware');
const { handleUpload }= require('../middleware/uploadMiddleware');

const router = express.Router();

// ── Validation rules ──────────────────────────────────────────
const itemValidation = [
  body('title')
    .trim().notEmpty().withMessage('Item title is required.')
    .isLength({ max: 200 }).withMessage('Title must be under 200 characters.'),
  body('category')
    .trim().notEmpty().withMessage('Category is required.'),
  body('location')
    .trim().notEmpty().withMessage('Location is required.'),
  body('date_lost')
    .notEmpty().withMessage('Date is required.')
    .isDate().withMessage('Date must be a valid date (YYYY-MM-DD).'),
  body('type')
    .isIn(['lost', 'found']).withMessage('Type must be "lost" or "found".'),
  body('description')
    .optional().trim().isLength({ max: 2000 }).withMessage('Description is too long.'),
];

const updateValidation = [
  body('title')
    .optional().trim()
    .isLength({ min: 1, max: 200 }).withMessage('Title must be 1–200 characters.'),
  body('status')
    .optional()
    .isIn(['lost','found','claimed','returned']).withMessage('Invalid status value.'),
];

// ── Routes ────────────────────────────────────────────────────

// Public routes (no auth needed)
router.get('/stats', itemController.getStats);
router.get('/',      itemController.getItems);

// Protected routes
router.get('/my',    protect, itemController.getMyItems);

// Single item (public)
router.get('/:id',   itemController.getItemById);

// Create item with optional image upload
router.post('/',
  protect,
  handleUpload,        // multer — must run before validators that read req.body
  itemValidation,
  itemController.createItem
);

// Update item with optional image replacement
router.put('/:id',
  protect,
  handleUpload,
  updateValidation,
  itemController.updateItem
);

// Delete item
router.delete('/:id', protect, itemController.deleteItem);

module.exports = router;
