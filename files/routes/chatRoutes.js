/**
 * routes/chatRoutes.js
 *
 * Protected chat routes.
 */

'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const chatController = require('../controllers/chatController');

const router = express.Router();

router.use(protect);

router.get('/my', chatController.getMyConversations);
router.get('/realtime-auth', chatController.getRealtimeAuth);
router.get('/conversations/:conversationId', chatController.getConversation);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', chatController.sendMessage);
router.patch('/conversations/:conversationId/read', chatController.markMessagesRead);

module.exports = router;
