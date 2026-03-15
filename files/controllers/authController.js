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
  const { password, password_hash, security_answer, ...safe } = user; // eslint-disable-line no-unused-vars
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

    const {
      name,
      email,
      password,
      role,
      department,
      phone,
      security_question,
      security_answer
    } = req.body;

    // ── Check for duplicate email ──────────────────────────
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error:   'An account with this email address already exists.',
      });
    }

    // ── Create user (model hashes the password & answer) ────────────
    const user  = await User.create({
      name,
      email,
      password,
      role,
      department,
      phone,
      security_question,
      security_answer
    });
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
    const passwordHash = user.password || user.password_hash;
    if (!passwordHash) {
      return res.status(401).json({
        success: false,
        error:   'Invalid email or password.',
      });
    }
    const passwordMatch = await User.verifyPassword(password, passwordHash);
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
      data:    safeUser(req.user),
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
      data:    safeUser(updated),
    });
  } catch (err) {
    next(err);
  }
};
// ── GET /api/auth/security-question/:email ────────────────────
const getSecurityQuestion = async (req, res, next) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const user = await User.findByEmail(email);
    if (!user || !user.security_question) {
      return res.status(404).json({ success: false, error: 'User not found or no security question set.' });
    }

    return res.status(200).json({
      success: true,
      data: { question: user.security_question }
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/reset-password-security ────────────────────
const resetPasswordSecurity = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, security_answer, new_password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Determine if the answer is a match (case-insensitive trim)
    const isMatch = await require('bcryptjs').compare(security_answer.trim().toLowerCase(), user.security_answer || '');
    
    // Fallback logic incase it was saved without hashing somehow
    const isDirectMatch = security_answer.trim().toLowerCase() === (user.security_answer || '').trim().toLowerCase();

    if (!isMatch && !isDirectMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect security answer.' });
    }

    // Update password
    await User.updatePassword(user.id, new_password);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in.',
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getProfile, updateProfile, getSecurityQuestion, resetPasswordSecurity };
