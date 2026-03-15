/**
 * models/Item.js
 *
 * All database interactions for the `items` table.
 * Supports filtering, pagination, full-text search, and joins
 * to pull reporter info alongside each item.
 */

'use strict';

const pool = require('../config/db');

const Item = {

  // ── Query helpers ─────────────────────────────────────────────

  /**
   * Build a WHERE clause from filter options.
   * Returns { clause: string, values: any[] }
   */
  _buildFilters({ type, status, category, q, userId } = {}) {
    const conditions = [];
    const values     = [];

    if (type)     { conditions.push('i.type = ?');     values.push(type);     }
    if (status)   { conditions.push('i.status = ?');   values.push(status);   }
    if (category) { conditions.push('i.category = ?'); values.push(category); }
    if (userId)   { conditions.push('i.user_id = ?');  values.push(userId);   }

    // Full-text search across title, description, location
    if (q && q.trim()) {
      conditions.push('(i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)');
      const like = `%${q.trim()}%`;
      values.push(like, like, like);
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
  },

  // ── Read ──────────────────────────────────────────────────────

  /**
   * List items with optional filters + pagination.
   * Joins user info so the reporter's name is included.
   *
   * @param {{ type?, status?, category?, q?, userId?, page?, limit?, sort? }} filters
   * @returns {{ items, total, page, limit }}
   */
  async findAll(filters = {}) {
    const { page = 1, limit = 20, sort = 'newest' } = filters;
    const offset = (page - 1) * limit;

    const { clause, values } = this._buildFilters(filters);

    // Determine ORDER BY
    const orderMap = {
      newest:   'i.created_at DESC',
      oldest:   'i.created_at ASC',
      az:       'i.title ASC',
      za:       'i.title DESC',
      date:     'i.date_lost DESC',
    };
    const orderBy = orderMap[sort] || 'i.created_at DESC';

    const sql = `
      SELECT
        i.*,
        u.name        AS reporter_name,
        u.department  AS reporter_department,
        u.email       AS reporter_email,
        (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id AND c.status = 'pending') AS pending_claims
      FROM items i
      LEFT JOIN users u ON i.user_id = u.id
      ${clause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) AS total FROM items i ${clause}`;

    const [items]        = await pool.query(sql,      [...values, limit, offset]);
    const [[{ total }]]  = await pool.query(countSql,  values);

    return { items, total: Number(total), page: Number(page), limit: Number(limit) };
  },

  /**
   * Find a single item by ID, including reporter details and claim count.
   * @param {number} id
   * @returns {object|null}
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT
         i.*,
         u.name        AS reporter_name,
         u.department  AS reporter_department,
         u.email       AS reporter_email,
         (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id)                          AS total_claims,
         (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id AND c.status='pending')   AS pending_claims
       FROM items i
       LEFT JOIN users u ON i.user_id = u.id
       WHERE i.id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * List items reported by a specific user.
   * @param {number} userId
   * @returns {object[]}
   */
  async findByUser(userId) {
    const [rows] = await pool.query(
      `SELECT i.*,
         (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id AND c.status='pending') AS pending_claims
       FROM items i
       WHERE i.user_id = ?
       ORDER BY i.created_at DESC`,
      [userId]
    );
    return rows;
  },

  // ── Stats ─────────────────────────────────────────────────────

  /**
   * Return aggregate counts for the dashboard stat cards.
   * @returns {{ total, lost, found, claimed, returned, pending_claims }}
   */
  async getStats() {
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*)                                       AS total,
        SUM(status = 'lost')                           AS lost,
        SUM(status = 'found')                          AS found,
        SUM(status = 'claimed')                        AS claimed,
        SUM(status = 'returned')                       AS returned,
        (SELECT COUNT(*) FROM claims WHERE status = 'pending') AS pending_claims
      FROM items
    `);
    // Convert BigInt/string results to plain numbers
    return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Number(v)]));
  },

  // ── Write ─────────────────────────────────────────────────────

  /**
   * Create a new item.
   * @param {{ title, category, description, location, date_lost, time_lost?,
   *           image?, color?, brand?, reward?, type, user_id }} data
   * @returns {object} the newly created item
   */
  async create(data) {
    const {
      title, category, description = null, location,
      date_lost, time_lost = null, image = null,
      color = null, brand = null, reward = null,
      type, user_id,
    } = data;

    // Initial status mirrors the type ('lost' → 'lost', 'found' → 'found')
    const status = type;

    const [result] = await pool.query(
      `INSERT INTO items
         (title, category, description, location, date_lost, time_lost,
          image, color, brand, reward, type, status, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, category, description, location, date_lost, time_lost,
       image, color, brand, reward, type, status, user_id]
    );

    return this.findById(result.insertId);
  },

  /**
   * Update item fields. Only provided fields are changed.
   * @param {number} id
   * @param {object} data
   * @returns {object|null}
   */
  async update(id, data) {
    const allowed = ['title','category','description','location','date_lost',
                     'time_lost','image','color','brand','reward','status'];
    const fields  = [];
    const values  = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (!fields.length) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  /**
   * Delete an item (and cascades to claims via FK).
   * @param {number} id
   * @returns {boolean}
   */
  async delete(id) {
    const [result] = await pool.query('DELETE FROM items WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

};

module.exports = Item;
