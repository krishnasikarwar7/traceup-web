/**
 * controllers/authController.js
 *
 * Handles user authentication: register, login, and profile retrieval.
 * Passwords are hashed by the User model using bcrypt.
 * JWTs are signed here and returned to the client.
 */

'use strict';

const jwt             = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User            = require('../models/User');

// ── JWT helper ────────────────────────────────────────────────
/**
 * Sign a JWT containing only the user's id and role.
 * Never put sensitive data (password, etc.) in the payload.
 */
const signToken = (user) =>
  jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

/**
 * Build a safe user object to return in responses.
 * Removes the password field.
 */
const safeUser = (user) => {
  const { password, ...safe } = user; // eslint-disable-line no-unused-vars
  return safe;
};

// ── POST /api/auth/register ───────────────────────────────────
const register = async (req, res, next) => {
  try {
    // ── Validate request body ──────────────────────────────
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role = 'user', department, phone } = req.body;

    // ── Check for duplicate email ──────────────────────────
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error:   'An account with this email address already exists.',
      });
    }

    // ── Create user (model hashes the password) ────────────
    const user  = await User.create({ name, email, password, role, department, phone });
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data:    { token, user: safeUser(user) },
    });

  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // ── Look up user (includes password hash) ─────────────
    const user = await User.findByEmail(email);
    if (!user) {
      // Use a generic message to avoid leaking whether the email exists
      return res.status(401).json({
        success: false,
        error:   'Invalid email or password.',
      });
    }

    // ── Verify password ────────────────────────────────────
    const passwordMatch = await User.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error:   'Invalid email or password.',
      });
    }

    // ── Issue token ────────────────────────────────────────
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data:    { token, user: safeUser(user) },
    });

  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/profile ─────────────────────────────────────
// Protected: requires valid JWT (set by authMiddleware)
const getProfile = async (req, res, next) => {
  try {
    // req.user is already set by protect middleware
    return res.status(200).json({
      success: true,
      data:    req.user,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/profile ─────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, department, phone } = req.body;
    const updated = await User.update(req.user.id, { name, department, phone });

    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      data:    updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getProfile, updateProfile };
