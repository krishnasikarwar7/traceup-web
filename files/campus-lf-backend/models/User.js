/**
 * models/User.js
 *
 * All database interactions for the `users` table.
 * Each method returns plain JS objects (not class instances).
 */

'use strict';

const pool    = require('../config/db');
const bcrypt  = require('bcryptjs');

const SALT_ROUNDS = 12; // higher = slower hash but more secure

const User = {

  // ── Find single user ─────────────────────────────────────────

  /**
   * Find user by primary key.
   * @param {number} id
   * @returns {object|null}
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, department, phone, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find user by email (includes password hash — used for login).
   * @param {string} email
   * @returns {object|null}
   */
  async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT id, name, email, password, role, department, phone, created_at
       FROM users WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  // ── Create ───────────────────────────────────────────────────

  /**
   * Create a new user. Hashes password before storing.
   * @param {{ name, email, password, role?, department?, phone? }} data
   * @returns {{ id, name, email, role, department }}
   */
  async create({ name, email, password, role = 'user', department = null, phone = null }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, department, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role, department, phone]
    );

    return this.findById(result.insertId);
  },

  // ── Update ───────────────────────────────────────────────────

  /**
   * Update user profile fields.
   * @param {number} id
   * @param {{ name?, department?, phone? }} data
   * @returns {object|null}
   */
  async update(id, { name, department, phone }) {
    const fields  = [];
    const values  = [];

    if (name       !== undefined) { fields.push('name = ?');       values.push(name.trim()); }
    if (department !== undefined) { fields.push('department = ?'); values.push(department);  }
    if (phone      !== undefined) { fields.push('phone = ?');      values.push(phone);       }

    if (!fields.length) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  /**
   * Change a user's password. Hashes the new password.
   * @param {number} id
   * @param {string} newPassword
   */
  async updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, id]);
  },

  // ── Auth ─────────────────────────────────────────────────────

  /**
   * Verify a plain-text password against the stored hash.
   * @param {string} plainPassword
   * @param {string} hashedPassword
   * @returns {boolean}
   */
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  // ── Admin ─────────────────────────────────────────────────────

  /**
   * List all users (admin use). Excludes password column.
   * @returns {object[]}
   */
  async findAll({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, name, email, role, department, phone, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    return { users: rows, total, page, limit };
  },

};

module.exports = User;
