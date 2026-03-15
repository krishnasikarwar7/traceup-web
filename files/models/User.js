/**
 * models/User.js
 *
 * Supabase-backed User model with wrapper methods
 * matching the existing controller expectations.
 */

'use strict';

const supabase = require('../config/db');
const bcrypt   = require('bcryptjs');

const SALT_ROUNDS = 12;
const TABLE = 'users';

const isMissingColumnError = (error, column) => {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  const normalizedColumn = column.toLowerCase();
  return (
    (msg.includes(`column "${normalizedColumn}"`) && msg.includes('does not exist')) ||
    (msg.includes(normalizedColumn) && msg.includes('schema cache'))
  );
};

const User = {

  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  },

  async findByEmail(email) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data) return null;
    return data;
  },

  async create({
    name,
    email,
    password,
    role = 'user',
    department = null,
    phone = null,
    security_question,
    security_answer
  }) {
    if (!name || !email || !password || !security_question || !security_answer) {
      throw new Error('Name, email, password, security question, and answer are required.');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const hashedAnswer = await bcrypt.hash(security_answer, SALT_ROUNDS);

    const basePayload = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      department,
      phone,
      security_question,
      security_answer: hashedAnswer
    };

    const selectFields = 'id, name, email, role, department, phone, security_question, created_at';

    const firstAttempt = await supabase
      .from(TABLE)
      .insert({ ...basePayload, password: hashedPassword })
      .select(selectFields)
      .single();

    if (!firstAttempt.error) return firstAttempt.data;
    if (!isMissingColumnError(firstAttempt.error, 'password')) {
      throw new Error(firstAttempt.error.message);
    }

    const secondAttempt = await supabase
      .from(TABLE)
      .insert({ ...basePayload, password_hash: hashedPassword })
      .select(selectFields)
      .single();

    if (secondAttempt.error) throw new Error(secondAttempt.error.message);
    return secondAttempt.data;
  },

  async update(id, { name, department, phone }) {
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (department !== undefined) updateData.department = department;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) return this.findById(id);

    const { data, error } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const firstAttempt = await supabase
      .from(TABLE)
      .update({ password: hash })
      .eq('id', id);

    if (!firstAttempt.error) return;
    if (!isMissingColumnError(firstAttempt.error, 'password')) {
      throw new Error(firstAttempt.error.message);
    }

    const secondAttempt = await supabase
      .from(TABLE)
      .update({ password_hash: hash })
      .eq('id', id);

    if (secondAttempt.error) throw new Error(secondAttempt.error.message);
  },

  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  async findAll({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase
      .from(TABLE)
      .select('id, name, email, role, department, phone, created_at', { count: 'exact' });

    q = q.order('created_at', { ascending: false }).range(from, to);

    const { data: users, error, count } = await q;
    if (error) throw new Error(error.message);

    return { users: users || [], total: count || 0, page, limit };
  }
};

module.exports = User;
