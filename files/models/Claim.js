/**
 * models/Claim.js
 *
 * Supabase-backed Claim model with wrappers for existing controllers.
 */

'use strict';

const supabase = require('../config/db');

const TABLE = 'claims';

// Select string for joined queries
const CLAIM_SELECT = `
  *,
  item:items!claims_item_id_fkey ( id, title, category, image, status, type, reporter:users!inner (id, name, email) ),
  claimant:users!claims_claimant_id_fkey ( id, name, email )
`;

/**
 * Flatten the joined data to match what controllers expect.
 */
const formatClaim = (doc) => {
  if (!doc) return null;
  const c = { ...doc };

  if (c.item) {
    c.item_id       = c.item.id;
    c.item_title    = c.item.title;
    c.item_category = c.item.category;
    c.item_image    = c.item.image;
    c.item_status   = c.item.status;
    c.item_type     = c.item.type;
    c.reporter_id   = c.item.reporter?.id;
    c.reporter_name = c.item.reporter?.name;
    c.reporter_email = c.item.reporter?.email;
    delete c.item;
  }

  if (c.claimant) {
    c.claimant_id    = c.claimant.id;
    c.claimant_name  = c.claimant.name;
    c.claimant_email = c.claimant.email;
    delete c.claimant;
  }

  return c;
};

const Claim = {

  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CLAIM_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return formatClaim(data);
  },

  async findByItem(itemId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        claimant:users!claims_claimant_id_fkey ( id, name, email )
      `)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(formatClaim);
  },

  async findByUser(userId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        item:items!claims_item_id_fkey ( id, title, category, image, status, type, reporter:users!inner (id, name, email) )
      `)
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(formatClaim);
  },

  async findAll({ status, page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase
      .from(TABLE)
      .select(CLAIM_SELECT, { count: 'exact' });

    if (status) q = q.eq('status', status);

    q = q.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return {
      claims: (data || []).map(formatClaim),
      total:  count || 0,
      page:   Number(page),
      limit:  Number(limit),
    };
  },

  async hasPendingClaim(itemId, userId) {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('item_id', itemId)
      .eq('claimant_id', userId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return (count || 0) > 0;
  },

  async create({ item_id, claimant_id, message, contact = null }) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ item_id, claimant_id, message, contact })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.findById(data.id);
  },

  async updateStatus(id, status, adminNote = null) {
    const updateData = { status };
    if (adminNote !== null) updateData.admin_note = adminNote;

    const { error } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', id);

    if (error) throw new Error(error.message);
    return this.findById(id);
  },

  /**
   * Reject all other pending claims for an item, except the given claim ID.
   * Used when approving a claim.
   */
  async rejectOtherPending(itemId, excludeClaimId) {
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'rejected', admin_note: 'Another claim was approved for this item.' })
      .eq('item_id', itemId)
      .neq('id', excludeClaimId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
  },

  /**
   * Count pending claims for an item.
   */
  async countPending(itemId) {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('item_id', itemId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return count || 0;
  },

  async getStats() {
    const [pending, approved, rejected] = await Promise.all([
      supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);

    return {
      pending:  pending.count || 0,
      approved: approved.count || 0,
      rejected: rejected.count || 0,
    };
  }
};

module.exports = Claim;
