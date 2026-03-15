/**
 * models/Claim.js
 *
 * All database interactions for the `claims` table.
 */

'use strict';

const pool = require('../config/db');

const Claim = {

  // ── Read ──────────────────────────────────────────────────────

  /**
   * Find a claim by primary key with item and claimant details joined.
   * @param {number} id
   * @returns {object|null}
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT
         cl.*,
         i.title         AS item_title,
         i.category      AS item_category,
         i.location      AS item_location,
         i.image         AS item_image,
         i.status        AS item_status,
         i.type          AS item_type,
         u.name          AS claimant_name,
         u.email         AS claimant_email,
         u.department    AS claimant_department
       FROM claims cl
       JOIN items i  ON cl.item_id     = i.id
       JOIN users u  ON cl.claimant_id = u.id
       WHERE cl.id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Get all claims for a specific item (admin / item owner use).
   * @param {number} itemId
   * @returns {object[]}
   */
  async findByItem(itemId) {
    const [rows] = await pool.query(
      `SELECT
         cl.*,
         u.name        AS claimant_name,
         u.email       AS claimant_email,
         u.department  AS claimant_department,
         u.phone       AS claimant_phone
       FROM claims cl
       JOIN users u ON cl.claimant_id = u.id
       WHERE cl.item_id = ?
       ORDER BY cl.created_at DESC`,
      [itemId]
    );
    return rows;
  },

  /**
   * Get all claims submitted by a specific user.
   * @param {number} userId
   * @returns {object[]}
   */
  async findByUser(userId) {
    const [rows] = await pool.query(
      `SELECT
         cl.*,
         i.title      AS item_title,
         i.category   AS item_category,
         i.location   AS item_location,
         i.image      AS item_image,
         i.status     AS item_status
       FROM claims cl
       JOIN items i ON cl.item_id = i.id
       WHERE cl.claimant_id = ?
       ORDER BY cl.created_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Get ALL claims (admin dashboard) with full item + claimant info.
   * Supports optional status filter.
   * @param {{ status?, page?, limit? }} options
   * @returns {{ claims, total, page, limit }}
   */
  async findAll({ status, page = 1, limit = 20 } = {}) {
    const offset     = (page - 1) * limit;
    const conditions = status ? ['cl.status = ?'] : [];
    const values     = status ? [status] : [];
    const where      = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT
         cl.*,
         i.title         AS item_title,
         i.category      AS item_category,
         i.location      AS item_location,
         i.image         AS item_image,
         i.type          AS item_type,
         i.status        AS item_status,
         u.name          AS claimant_name,
         u.email         AS claimant_email,
         u.department    AS claimant_department
       FROM claims cl
       JOIN items i  ON cl.item_id     = i.id
       JOIN users u  ON cl.claimant_id = u.id
       ${where}
       ORDER BY cl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM claims cl ${where}`,
      values
    );

    return { claims: rows, total: Number(total), page: Number(page), limit: Number(limit) };
  },

  /**
   * Check if a user already has a pending claim for an item.
   * Prevents duplicate claims.
   * @param {number} itemId
   * @param {number} userId
   * @returns {boolean}
   */
  async hasPendingClaim(itemId, userId) {
    const [rows] = await pool.query(
      `SELECT id FROM claims
       WHERE item_id = ? AND claimant_id = ? AND status = 'pending'
       LIMIT 1`,
      [itemId, userId]
    );
    return rows.length > 0;
  },

  // ── Write ─────────────────────────────────────────────────────

  /**
   * Create a new claim.
   * @param {{ item_id, claimant_id, message, contact? }} data
   * @returns {object} the newly created claim
   */
  async create({ item_id, claimant_id, message, contact = null }) {
    const [result] = await pool.query(
      `INSERT INTO claims (item_id, claimant_id, message, contact)
       VALUES (?, ?, ?, ?)`,
      [item_id, claimant_id, message, contact]
    );
    return this.findById(result.insertId);
  },

  /**
   * Update claim status (approve or reject).
   * @param {number} id
   * @param {'approved'|'rejected'} status
   * @param {string|null} adminNote
   * @returns {object|null}
   */
  async updateStatus(id, status, adminNote = null) {
    await pool.query(
      `UPDATE claims SET status = ?, admin_note = ? WHERE id = ?`,
      [status, adminNote, id]
    );
    return this.findById(id);
  },

  /**
   * Count claims grouped by status for dashboard stats.
   * @returns {{ pending, approved, rejected }}
   */
  async getStats() {
    const [[stats]] = await pool.query(`
      SELECT
        SUM(status = 'pending')  AS pending,
        SUM(status = 'approved') AS approved,
        SUM(status = 'rejected') AS rejected
      FROM claims
    `);
    return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Number(v)]));
  },

};

module.exports = Claim;
