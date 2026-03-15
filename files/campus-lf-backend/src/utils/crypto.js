/**
 * crypto.js
 * Pure Node.js crypto utilities — no external packages.
 *  - Password hashing  (PBKDF2 via crypto module)
 *  - JWT sign / verify (HMAC-SHA256)
 */

const crypto = require('crypto');

/* ── Config ───────────────────────────────────── */
const JWT_SECRET    = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES   = process.env.JWT_EXPIRES_IN || '7d';
const PBKDF2_ITER   = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

/* ══════════════════════════════════════════════
   PASSWORD HASHING  (PBKDF2 — Node built-in)
══════════════════════════════════════════════ */

/** Async hash — use in controllers */
function hashPassword(plain) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(32).toString('hex');
    crypto.pbkdf2(plain, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

/** Sync hash — only for DB seeding */
function hashPasswordSync(plain) {
  const salt = crypto.randomBytes(32).toString('hex');
  const key  = crypto.pbkdf2Sync(plain, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt}:${key.toString('hex')}`;
}

/** Verify plain against stored hash */
function verifyPassword(plain, stored) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return resolve(false);
    crypto.pbkdf2(plain, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key));
    });
  });
}

/* ══════════════════════════════════════════════
   JWT  (HMAC-SHA256 — pure Node)
══════════════════════════════════════════════ */

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function parseDuration(dur) {
  const match = String(dur).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 3600;
  const [, n, unit] = match;
  const m = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(n) * m[unit];
}

function signJwt(payload) {
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now     = Math.floor(Date.now() / 1000);
  const exp     = now + parseDuration(JWT_EXPIRES);
  const body    = base64url(JSON.stringify({ ...payload, iat: now, exp }));
  const sig     = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

module.exports = { hashPassword, hashPasswordSync, verifyPassword, signJwt, verifyJwt };
