/**
 * controllers/chatController.js
 *
 * Finder <-> claimer chat endpoints.
 */

'use strict';

const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const isConversationParticipant = (conversation, user) => (
  user.role === 'admin' ||
  String(conversation.finder_id) === String(user.id) ||
  String(conversation.claimer_id) === String(user.id)
);

const getConversationOr404 = async (conversationId, res) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    res.status(404).json({ success: false, error: 'Conversation not found.' });
    return null;
  }
  return conversation;
};

const getMyConversations = async (req, res, next) => {
  try {
    const conversations = req.user.role === 'admin'
      ? await Conversation.findAllForAdmin({ limit: 200 })
      : await Conversation.findByUser(req.user.id, { limit: 200 });

    return res.status(200).json({
      success: true,
      data: conversations,
      meta: { total: conversations.length },
    });
  } catch (err) {
    next(err);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const conversation = await getConversationOr404(req.params.conversationId, res);
    if (!conversation) return;

    if (!isConversationParticipant(conversation, req.user)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const conversation = await getConversationOr404(req.params.conversationId, res);
    if (!conversation) return;

    if (!isConversationParticipant(conversation, req.user)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const messages = await Message.findByConversation(conversation.id);
    return res.status(200).json({
      success: true,
      data: messages,
      meta: { total: messages.length },
    });
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const conversation = await getConversationOr404(req.params.conversationId, res);
    if (!conversation) return;

    if (!isConversationParticipant(conversation, req.user)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message must be 2000 characters or fewer.' });
    }

    const message = await Message.create({
      conversation_id: conversation.id,
      sender_id: req.user.id,
      content,
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent.',
      data: message,
    });
  } catch (err) {
    next(err);
  }
};

const markMessagesRead = async (req, res, next) => {
  try {
    const conversation = await getConversationOr404(req.params.conversationId, res);
    if (!conversation) return;

    if (!isConversationParticipant(conversation, req.user)) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const updated = await Message.markReadForViewer(conversation.id, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
      data: { updated },
    });
  } catch (err) {
    next(err);
  }
};

const getRealtimeAuth = async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(501).json({
        success: false,
        error: 'Realtime is not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY.',
      });
    }

    const signingSecret = process.env.SUPABASE_JWT_SECRET;
    if (!signingSecret) {
      return res.status(501).json({
        success: false,
        error: 'Realtime is not configured. Missing SUPABASE_JWT_SECRET.',
      });
    }

    const realtimeToken = jwt.sign(
      {
        sub: req.user.id,
        role: 'authenticated',
        aud: 'authenticated',
        userId: req.user.id,
      },
      signingSecret,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      success: true,
      data: {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        realtimeToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyConversations,
  getConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
  getRealtimeAuth,
};
