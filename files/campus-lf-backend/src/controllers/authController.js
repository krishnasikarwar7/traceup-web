/**
 * authController.js
 */

const { Users }                      = require('../db/database');
const { hashPassword, verifyPassword, signJwt } = require('../utils/crypto');
const { ok, created, error, unauthorized, serverError } = require('../utils/response');

/* ── POST /api/auth/register ─────────────────── */
async function register(req, res) {
  try {
    const { name, email, password, role = 'student', dept = '' } = req.body;

    if (Users.findByEmail(email))
      return error(res, 'An account with this email already exists.', 409);

    const passwordHash = await hashPassword(password);
    // Prevent self-promotion to admin via register
    const safeRole = ['student', 'faculty', 'staff'].includes(role) ? role : 'student';

    const user  = Users.create({ name, email, passwordHash, role: safeRole, dept });
    const token = signJwt({ userId: user.id, role: user.role });

    return created(res, { token, user: Users.safe(user) }, 'Account created successfully');
  } catch (err) {
    return serverError(res, err);
  }
}

/* ── POST /api/auth/login ────────────────────── */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = Users.findByEmail(email);
    if (!user) return unauthorized(res, 'Invalid email or password.');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid)  return unauthorized(res, 'Invalid email or password.');

    const token = signJwt({ userId: user.id, role: user.role });

    return ok(res, { token, user: Users.safe(user) }, 'Logged in successfully');
  } catch (err) {
    return serverError(res, err);
  }
}

/* ── GET /api/auth/me ────────────────────────── */
function me(req, res) {
  return ok(res, { user: req.user });
}

/* ── PUT /api/auth/me ────────────────────────── */
async function updateMe(req, res) {
  try {
    const { name, dept, password } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (dept) updates.dept = dept;
    if (password) {
      if (password.length < 6) return error(res, 'Password must be at least 6 characters');
      updates.passwordHash = await hashPassword(password);
    }
    const updated = Users.update(req.user.id, updates);
    return ok(res, { user: Users.safe(updated) }, 'Profile updated');
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { register, login, me, updateMe };
