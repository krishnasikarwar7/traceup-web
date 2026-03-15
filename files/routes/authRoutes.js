/**
 * routes/authRoutes.js
 *
 * POST /api/auth/register  — create a new account
 * POST /api/auth/login     — authenticate and receive a JWT
 * GET  /api/auth/profile   — get current user's profile (protected)
 * PUT  /api/auth/profile   — update current user's profile (protected)
 */

'use strict';

const express              = require('express');
const { body }             = require('express-validator');
const authController       = require('../controllers/authController');
const { protect }          = require('../middleware/authMiddleware');

const router = express.Router();

// ── Validation rules ──────────────────────────────────────────
const registerValidation = [
  // Name is required
  body('name').trim().notEmpty().withMessage('Name is required.'),
  // Email must be valid
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  // Password must be at least 6 characters
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  // Role (optional, defaults to 'user', must be one of allowed values)
  body('role').optional().isIn(['user', 'admin']).withMessage('Role must be user or admin.'),
  // Security Question is required
  body('security_question').trim().notEmpty().withMessage('Security question is required.'),
  // Security Answer is required
  body('security_answer').trim().notEmpty().withMessage('Security answer is required.'),
  body('department')
    .optional().trim()
    .isLength({ max: 100 }).withMessage('Department must be under 100 characters.'),
  body('phone')
    .optional().trim(),
];

const loginValidation = [
  body('email')
    .trim().isEmail().withMessage('A valid email address is required.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
];

const profileValidation = [
  body('name')
    .optional().trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('phone')
    .optional()
    .isMobilePhone().withMessage('Invalid phone number.'),
];

// ── Routes ────────────────────────────────────────────────────
router.post('/register', registerValidation, authController.register);
router.post('/login',    loginValidation,    authController.login);
router.get( '/profile',  protect,            authController.getProfile);
router.put( '/profile',  protect, profileValidation, authController.updateProfile);

// ── Get Security Question ───────────────────────────────────────
router.get(
  '/security-question/:email',
  authController.getSecurityQuestion
);

// ── Reset Password via Security Answer ──────────────────────────
router.post(
  '/reset-password-security',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('security_answer').trim().notEmpty().withMessage('Security answer is required.'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.')
  ],
  authController.resetPasswordSecurity
);

module.exports = router;
