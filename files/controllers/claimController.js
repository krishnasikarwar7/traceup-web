/**
 * controllers/claimController.js
 *
 * Handles claim requests: submitting a claim and viewing user claims.
 * Admin-specific claim actions (approve/reject) live in adminController.js.
 */

'use strict';

const { validationResult } = require('express-validator');
const Claim = require('../models/Claim');
const Item  = require('../models/Item');
const Conversation = require('../models/Conversation');

// ── POST /api/claims ──────────────────────────────────────────
/**
 * Submit a new claim for an item.
 * The claimant must be logged in, and cannot be the item's original reporter.
 */
const createClaim = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { item_id, message, contact } = req.body;

    // ── Verify the item exists ─────────────────────────────
    const item = await Item.findById(item_id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    // ── Cannot claim your own item ─────────────────────────
    if (String(item.user_id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        error:   'You cannot claim an item that you reported.',
      });
    }

    // ── Item must be in a claimable state ──────────────────
    if (item.status === 'returned') {
      return res.status(400).json({
        success: false,
        error:   'This item has already been returned and cannot be claimed.',
      });
    }

    // ── Prevent duplicate pending claim from same user ─────
    const alreadyClaimed = await Claim.hasPendingClaim(item_id, req.user.id);
    if (alreadyClaimed) {
      const conversation = await Conversation.findOrCreate({
        item_id,
        finder_id: item.user_id,
        claimer_id: req.user.id,
      });

      return res.status(409).json({
        success: false,
        error:   'You already have a pending claim for this item.',
        data: {
          conversation_id: conversation?.id || null,
          chat_url: conversation?.id ? `/chat/${conversation.id}` : null,
        },
      });
    }

    // ── Create claim + update item status to 'claimed' ─────
    const claim = await Claim.create({
      item_id,
      claimant_id: req.user.id,
      message,
      contact: contact || null,
    });

    // Update item status to reflect it has a pending claim
    await Item.update(item_id, { status: 'claimed' });

    // Create (or fetch) one unique conversation for (item + claimer)
    const conversation = await Conversation.findOrCreate({
      item_id,
      finder_id: item.user_id,
      claimer_id: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Claim submitted successfully. You will be notified once reviewed.',
      data: {
        ...claim,
        conversation_id: conversation?.id || null,
        chat_url: conversation?.id ? `/chat/${conversation.id}` : null,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ── GET /api/claims/user ──────────────────────────────────────
/**
 * Get all claims submitted by the currently logged-in user.
 */
const getUserClaims = async (req, res, next) => {
  try {
    const claims = await Claim.findByUser(req.user.id);
    const withConversation = await Promise.all(
      claims.map(async (claim) => {
        const conversation = await Conversation.findByItemAndClaimer(claim.item_id, req.user.id);
        return {
          ...claim,
          conversation_id: conversation?.id || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data:    withConversation,
      meta:    { total: withConversation.length },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/claims/item/:itemId ──────────────────────────────
/**
 * Get all claims for a specific item.
 * Available to the item's owner or an admin.
 */
const getItemClaims = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    // Only item owner or admin can see claims for an item
    if (String(item.user_id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error:   'Access denied. You can only view claims for your own items.',
      });
    }

    const claims = await Claim.findByItem(req.params.itemId);
    const withConversation = await Promise.all(
      claims.map(async (claim) => {
        const conversation = await Conversation.findByItemAndClaimer(req.params.itemId, claim.claimant_id);
        return {
          ...claim,
          conversation_id: conversation?.id || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data:    withConversation,
      meta:    { total: withConversation.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createClaim, getUserClaims, getItemClaims };
