/**
 * models/Message.js
 *
 * Message model for private finder-claimer chats.
 */

'use strict';

const supabase = require('../config/db');

const TABLE = 'messages';

const MESSAGE_SELECT = `
  *,
  sender:users!messages_sender_id_fkey ( id, name, email )
`;

const formatMessage = (doc) => {
  if (!doc) return null;
  const m = { ...doc };

  if (m.sender) {
    m.sender_name = m.sender.name;
    m.sender_email = m.sender.email;
    delete m.sender;
  }

  return m;
};

const Message = {
  async findByConversation(conversationId, { limit = 500 } = {}) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map(formatMessage);
  },

  async create({ conversation_id, sender_id, content }) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ conversation_id, sender_id, content })
      .select(MESSAGE_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return formatMessage(data);
  },

  async markReadForViewer(conversationId, viewerId) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', viewerId)
      .eq('read', false)
      .select('id');

    if (error) throw new Error(error.message);
    return (data || []).length;
  },
};

module.exports = Message;
