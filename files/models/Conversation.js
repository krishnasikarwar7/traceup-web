/**
 * models/Conversation.js
 *
 * Conversation model for finder <-> claimer private chats.
 */

'use strict';

const supabase = require('../config/db');

const TABLE = 'conversations';

const CONVERSATION_SELECT = `
  *,
  item:items!conversations_item_id_fkey ( id, title, location, status ),
  finder:users!conversations_finder_id_fkey ( id, name, email ),
  claimer:users!conversations_claimer_id_fkey ( id, name, email )
`;

const formatConversation = (doc) => {
  if (!doc) return null;
  const c = { ...doc };

  if (c.item) {
    c.item_title = c.item.title;
    c.item_location = c.item.location;
    c.item_status = c.item.status;
  }

  if (c.finder) {
    c.finder_name = c.finder.name;
    c.finder_email = c.finder.email;
  }

  if (c.claimer) {
    c.claimer_name = c.claimer.name;
    c.claimer_email = c.claimer.email;
  }

  return c;
};

const enrichWithLastMessage = async (conversation) => {
  const { data: latest } = await supabase
    .from('messages')
    .select('id, content, created_at, sender_id, read')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id);

  return {
    ...conversation,
    last_message: latest || null,
    message_count: count || 0,
  };
};

const Conversation = {
  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CONVERSATION_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return formatConversation(data);
  },

  async findByItemAndClaimer(itemId, claimerId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CONVERSATION_SELECT)
      .eq('item_id', itemId)
      .eq('claimer_id', claimerId)
      .maybeSingle();

    if (error || !data) return null;
    return formatConversation(data);
  },

  async findOrCreate({ item_id, finder_id, claimer_id }) {
    const existing = await this.findByItemAndClaimer(item_id, claimer_id);
    if (existing) return existing;

    const { data, error } = await supabase
      .from(TABLE)
      .insert({ item_id, finder_id, claimer_id })
      .select('id')
      .single();

    if (error) {
      // Handle race condition when unique constraint is hit.
      if (error.code === '23505') {
        const concurrent = await this.findByItemAndClaimer(item_id, claimer_id);
        if (concurrent) return concurrent;
      }
      throw new Error(error.message);
    }

    return this.findById(data.id);
  },

  async findByUser(userId, { limit = 100 } = {}) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CONVERSATION_SELECT)
      .or(`finder_id.eq.${userId},claimer_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const conversations = (data || []).map(formatConversation);
    return Promise.all(conversations.map(enrichWithLastMessage));
  },

  async findAllForAdmin({ limit = 200 } = {}) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CONVERSATION_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const conversations = (data || []).map(formatConversation);
    return Promise.all(conversations.map(enrichWithLastMessage));
  },
};

module.exports = Conversation;
