/**
 * models/Item.js
 *
 * Supabase-backed Item model with wrappers for existing controllers.
 */

'use strict';

const supabase = require('../config/db');

const TABLE = 'items';

const Item = {

  _buildFilters(query) {
    let q = supabase
      .from(TABLE)
      .select(`
        *,
        users!inner ( id, name, email )
      `, { count: 'exact' });

    const { type, status, category, userId } = query;
    if (type)     q = q.eq('type', type);
    if (status)   q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    if (userId)   q = q.eq('user_id', userId);

    // Text search via ilike
    if (query.q && query.q.trim()) {
      const term = `%${query.q.trim()}%`;
      q = q.or(`title.ilike.${term},description.ilike.${term},location.ilike.${term}`);
    }

    return q;
  },

  async findAll(filters = {}) {
    const { page = 1, limit = 20, sort = 'newest' } = filters;
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = this._buildFilters(filters);

    // Sorting
    const sortMap = {
      newest: { column: 'created_at', ascending: false },
      oldest: { column: 'created_at', ascending: true },
      az:     { column: 'title',      ascending: true },
      za:     { column: 'title',      ascending: false },
      date:   { column: 'date_lost',  ascending: false },
    };
    const sortOpt = sortMap[sort] || sortMap.newest;
    q = q.order(sortOpt.column, { ascending: sortOpt.ascending });
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    // Get pending claim counts for each item
    const items = await Promise.all((data || []).map(async (i) => {
      const formatted = { ...i };
      // Flatten reporter join
      if (formatted.users) {
        formatted.reporter = {
          id: formatted.users.id,
          name: formatted.users.name,
          email: formatted.users.email
        };
        formatted.reporter_id = formatted.users.id;
        formatted.reporter_name = formatted.users.name;
        formatted.reporter_email = formatted.users.email;
        delete formatted.users;
      }
      // Pending claims count
      const { count: pendingCount } = await supabase
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', i.id)
        .eq('status', 'pending');
      formatted.pending_claims = pendingCount || 0;
      return formatted;
    }));

    return { items, total: count || 0, page: Number(page), limit: Number(limit) };
  },

  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        users!inner ( id, name, email )
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const item = { ...data };
    if (item.users) {
      item.reporter = {
        id: item.users.id,
        name: item.users.name,
        email: item.users.email
      };
      item.reporter_id = item.users.id;
      item.reporter_name = item.users.name;
      item.reporter_email = item.users.email;
      delete item.users;
    }

    // Claim counts
    const [totalResult, pendingResult] = await Promise.all([
      supabase.from('claims').select('id', { count: 'exact', head: true }).eq('item_id', id),
      supabase.from('claims').select('id', { count: 'exact', head: true }).eq('item_id', id).eq('status', 'pending')
    ]);

    item.total_claims   = totalResult.count || 0;
    item.pending_claims = pendingResult.count || 0;

    return item;
  },

  async findByUser(userId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const items = await Promise.all((data || []).map(async (i) => {
      const { count } = await supabase
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', i.id)
        .eq('status', 'pending');
      i.pending_claims = count || 0;
      return i;
    }));

    return items;
  },

  async getStats() {
    try {
      const qLost = supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'lost');
      const qFound = supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'found');
      const qClaimed = supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'claimed');
      const qReturned = supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'returned');
      const qPendingClaims = supabase
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      const [lostRes, foundRes, claimedRes, returnedRes, pendingClaimsRes] = await Promise.all([
        qLost,
        qFound,
        qClaimed,
        qReturned,
        qPendingClaims
      ]);

      return {
        total:          (lostRes.count || 0) + (foundRes.count || 0) + (claimedRes.count || 0) + (returnedRes.count || 0),
        lost:           lostRes.count || 0,
        found:          foundRes.count || 0,
        claimed:        claimedRes.count || 0,
        returned:       returnedRes.count || 0,
        pending_claims: pendingClaimsRes.count || 0,
      };
    } catch (error) {
      console.error("Error fetching item stats:", error.message);
      throw error;
    }
  },

  async create(data) {
    const {
      title, category, description = null, location,
      date_lost, time_lost = null, image = null,
      color = null, brand = null, reward = null,
      type, user_id,
    } = data;

    const status = type; // initial status matches type

    const { data: item, error } = await supabase
      .from(TABLE)
      .insert({
        title, category, description, location, date_lost, time_lost,
        image, color, brand, reward, type, status, user_id
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return this.findById(item.id);
  },

  async update(id, data) {
    const allowed = ['title','category','description','location','date_lost',
                     'time_lost','image','color','brand','reward','status'];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    if (Object.keys(updateData).length === 0) return this.findById(id);

    const { error } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return this.findById(id);
  },

  async delete(id) {
    // Delete related claims first (cascade should handle it, but be explicit)
    await supabase.from('claims').delete().eq('item_id', id);

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }
};

module.exports = Item;
