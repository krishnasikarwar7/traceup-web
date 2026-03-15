/**
 * controllers/itemController.js
 *
 * CRUD operations for lost/found items.
 * Image uploads are handled by uploadMiddleware before these
 * controller methods run — the file path is in req.file.
 */

'use strict';

const { validationResult } = require('express-validator');
const path                 = require('path');
const Item                 = require('../models/Item');
const { deleteFile }       = require('../middleware/uploadMiddleware');

// ── GET /api/items ────────────────────────────────────────────
const getItems = async (req, res, next) => {
  try {
    const { type, status, category, q, page = 1, limit = 20, sort = 'newest' } = req.query;

    const result = await Item.findAll({
      type,
      status,
      category,
      q,
      page:  parseInt(page,  10),
      limit: parseInt(limit, 10),
      sort,
    });

    // Attach full image URL if item has an image
    result.items = result.items.map(item => formatItem(item, req));

    return res.status(200).json({
      success: true,
      data:    result.items,
      meta: {
        total:       result.total,
        page:        result.page,
        limit:       result.limit,
        total_pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/items/stats ──────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const stats = await Item.getStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/items/my ─────────────────────────────────────────
const getMyItems = async (req, res, next) => {
  try {
    const items = await Item.findByUser(req.user.id);
    return res.status(200).json({
      success: true,
      data:    items.map(i => formatItem(i, req)),
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/items/:id ────────────────────────────────────────
const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }
    return res.status(200).json({ success: true, data: formatItem(item, req) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/items ───────────────────────────────────────────
const createItem = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) deleteFile(req.file.filename);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      title, category, description, location,
      date_lost, time_lost, color, brand, reward, type,
    } = req.body;

    // Build image path (relative) if a file was uploaded
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const item = await Item.create({
      title, category, description, location,
      date_lost, time_lost, image, color, brand, reward,
      type, user_id: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: `${type === 'lost' ? 'Lost' : 'Found'} item reported successfully.`,
      data:    formatItem(item, req),
    });
  } catch (err) {
    if (req.file) deleteFile(req.file.filename);
    next(err);
  }
};

// ── PUT /api/items/:id ────────────────────────────────────────
const updateItem = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) deleteFile(req.file.filename);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // ── Ownership check
    const existing = await Item.findById(req.params.id);
    if (!existing) {
      if (req.file) deleteFile(req.file.filename);
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    const isOwner = String(existing.user_id) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      if (req.file) deleteFile(req.file.filename);
      return res.status(403).json({
        success: false,
        error:   'You do not have permission to update this item.',
      });
    }

    // ── Build update payload
    const updates = {};
    const editableFields = ['title','category','description','location','date_lost','time_lost','color','brand','reward'];
    for (const field of editableFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // Only admins can change status directly
    if (req.body.status && isAdmin) updates.status = req.body.status;

    // Replace image if a new file was uploaded
    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
      if (existing.image) deleteFile(path.basename(existing.image));
    }

    const updated = await Item.update(req.params.id, updates);

    return res.status(200).json({
      success: true,
      message: 'Item updated successfully.',
      data:    formatItem(updated, req),
    });
  } catch (err) {
    if (req.file) deleteFile(req.file.filename);
    next(err);
  }
};

// ── DELETE /api/items/:id ─────────────────────────────────────
const deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    // Only owner or admin can delete
    if (String(item.user_id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error:   'You do not have permission to delete this item.',
      });
    }

    // Delete image file from disk if it exists
    if (item.image) deleteFile(path.basename(item.image));

    await Item.delete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Item deleted successfully.',
      data:    { id: req.params.id },
    });
  } catch (err) {
    next(err);
  }
};

// ── Helper: build absolute image URL ─────────────────────────
const formatItem = (item, req) => {
  if (!item) return item;
  return {
    ...item,
    image_url: item.image
      ? `${req.protocol}://${req.get('host')}${item.image}`
      : null,
  };
};

module.exports = { getItems, getStats, getMyItems, getItemById, createItem, updateItem, deleteItem };
