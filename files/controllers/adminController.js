/**
 * controllers/adminController.js
 *
 * Admin-only endpoints:
 *   - View all items with enriched data
 *   - Approve / Reject claims
 *   - Mark items as returned
 *   - View all users
 *   - Dashboard statistics
 */

'use strict';

const { validationResult } = require('express-validator');
const Item  = require('../models/Item');
const Claim = require('../models/Claim');
const User  = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const path  = require('path');
const { deleteFile } = require('../middleware/uploadMiddleware');

// ── GET /api/admin/stats ──────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [itemStats, claimStats] = await Promise.all([
      Item.getStats(),
      Claim.getStats(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items:  itemStats,
        claims: claimStats,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/items ──────────────────────────────────────
const getAllItems = async (req, res, next) => {
  try {
    const { type, status, category, q, page = 1, limit = 20, sort = 'newest' } = req.query;

    const result = await Item.findAll({
      type, status, category, q,
      page:  parseInt(page,  10),
      limit: parseInt(limit, 10),
      sort,
    });

    // Build absolute image URLs
    const items = result.items.map(item => ({
      ...item,
      image_url: item.image
        ? `${req.protocol}://${req.get('host')}${item.image}`
        : null,
    }));

    return res.status(200).json({
      success: true,
      data:    items,
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

// ── PUT /api/admin/items/:id/status ───────────────────────────
const updateItemStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['lost', 'found', 'claimed', 'returned'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error:   `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    const updated = await Item.update(req.params.id, { status });

    return res.status(200).json({
      success: true,
      message: `Item status updated to "${status}".`,
      data:    updated,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/items/:id/return ──────────────────────────
const markItemReturned = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    const updated = await Item.update(req.params.id, { status: 'returned' });

    return res.status(200).json({
      success: true,
      message: 'Item marked as returned.',
      data:    updated,
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/items/:id ───────────────────────────────
const deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    if (item.image) deleteFile(path.basename(item.image));
    await Item.delete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Item deleted.',
      data:    { id: req.params.id },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/claims ─────────────────────────────────────
const getAllClaims = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const result = await Claim.findAll({
      status,
      page:  parseInt(page,  10),
      limit: parseInt(limit, 10),
    });

    return res.status(200).json({
      success: true,
      data:    result.claims,
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

// ── PUT /api/admin/claims/:id/approve ─────────────────────────
/**
 * Approve a claim → mark item as 'returned', reject all other claims for that item.
 */
const approveClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found.' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error:   `Claim is already ${claim.status} and cannot be approved again.`,
      });
    }

    const adminNote = req.body.admin_note || null;

    // ── Approve this claim
    const updated = await Claim.updateStatus(req.params.id, 'approved', adminNote);

    // ── Mark item as returned
    await Item.update(claim.item_id, { status: 'returned' });

    // ── Reject all OTHER pending claims for the same item
    await Claim.rejectOtherPending(claim.item_id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Claim approved. Item marked as returned.',
      data:    updated,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/claims/:id/reject ──────────────────────────
/**
 * Reject a claim → revert item status back to its original type if no other pending claims.
 */
const rejectClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found.' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error:   `Claim is already ${claim.status}.`,
      });
    }

    const adminNote = req.body.admin_note || null;
    const updated   = await Claim.updateStatus(req.params.id, 'rejected', adminNote);

    // Revert item status if no other pending claims remain
    const pendingCount = await Claim.countPending(claim.item_id);

    if (pendingCount === 0) {
      const item = await Item.findById(claim.item_id);
      if (item) await Item.update(claim.item_id, { status: item.type }); // back to 'lost' or 'found'
    }

    return res.status(200).json({
      success: true,
      message: 'Claim rejected.',
      data:    updated,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users ──────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await User.findAll({
      page: parseInt(page,10),
      limit: parseInt(limit,10),
    });

    return res.status(200).json({
      success: true,
      data:    result.users,
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

// ── GET /api/admin/chats ──────────────────────────────────────
const getAllChats = async (req, res, next) => {
  try {
    const conversations = await Conversation.findAllForAdmin({ limit: 300 });
    return res.status(200).json({
      success: true,
      data: conversations,
      meta: { total: conversations.length },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/chats/:conversationId/messages ────────────
const getChatMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const messages = await Message.findByConversation(conversation.id);
    return res.status(200).json({
      success: true,
      data: {
        conversation,
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats, getAllItems, updateItemStatus, markItemReturned,
  deleteItem, getAllClaims, approveClaim, rejectClaim, getAllUsers,
  getAllChats, getChatMessages,
};
