/**
 * database.js
 * Lightweight JSON-file store — no external dependencies.
 * Acts as a simple relational-ish DB: users, items, claims.
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/db.json');

/* ── ensure data dir ──────────────────────────── */
function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    write({ users: [], items: [], claims: [] });
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function write(data) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/* ── ID generator ─────────────────────────────── */
function newId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ══════════════════════════════════════════════
   USERS
══════════════════════════════════════════════ */
const Users = {
  findAll() {
    return read().users;
  },

  findById(id) {
    return read().users.find(u => u.id === id) || null;
  },

  findByEmail(email) {
    return read().users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  create({ name, email, passwordHash, role = 'student', dept = '' }) {
    const db = read();
    const user = {
      id: newId('usr_'),
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,   // student | faculty | staff | admin
      dept,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    write(db);
    return user;
  },

  update(id, fields) {
    const db = read();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    db.users[idx] = { ...db.users[idx], ...fields, updatedAt: new Date().toISOString() };
    write(db);
    return db.users[idx];
  },

  safe(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  },
};

/* ══════════════════════════════════════════════
   ITEMS
══════════════════════════════════════════════ */
const Items = {
  findAll({ type, status, category, search, limit = 50, offset = 0 } = {}) {
    let items = read().items;

    if (type)     items = items.filter(i => i.type === type);
    if (status)   items = items.filter(i => i.status === status);
    if (category) items = items.filter(i => i.category === category);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q)
      );
    }

    // newest first
    items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = items.length;
    items = items.slice(Number(offset), Number(offset) + Number(limit));

    return { items, total };
  },

  findById(id) {
    return read().items.find(i => i.id === id) || null;
  },

  findByUser(userId) {
    return read().items.filter(i => i.reportedBy === userId);
  },

  create({ type, name, category, location, date, description, imageUrl = null, reportedBy, contact = '' }) {
    const db = read();
    const item = {
      id: newId('itm_'),
      type,        // 'lost' | 'found'
      name,
      category,
      location,
      date,
      description,
      imageUrl,
      reportedBy,
      contact,
      status: 'active',  // active | claimed | returned
      claimsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.items.push(item);
    write(db);
    return item;
  },

  update(id, fields) {
    const db = read();
    const idx = db.items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    db.items[idx] = { ...db.items[idx], ...fields, updatedAt: new Date().toISOString() };
    write(db);
    return db.items[idx];
  },

  delete(id) {
    const db = read();
    const idx = db.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    db.items.splice(idx, 1);
    write(db);
    return true;
  },

  stats() {
    const items = read().items;
    return {
      total:    items.length,
      lost:     items.filter(i => i.type === 'lost').length,
      found:    items.filter(i => i.type === 'found').length,
      claimed:  items.filter(i => i.status === 'claimed').length,
      returned: items.filter(i => i.status === 'returned').length,
    };
  },
};

/* ══════════════════════════════════════════════
   CLAIMS
══════════════════════════════════════════════ */
const Claims = {
  findAll({ itemId, userId, status } = {}) {
    let claims = read().claims;
    if (itemId) claims = claims.filter(c => c.itemId === itemId);
    if (userId) claims = claims.filter(c => c.userId === userId);
    if (status) claims = claims.filter(c => c.status === status);
    return claims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return read().claims.find(c => c.id === id) || null;
  },

  create({ itemId, userId, description, contact }) {
    const db = read();

    // Bump item claims count
    const iIdx = db.items.findIndex(i => i.id === itemId);
    if (iIdx !== -1) {
      db.items[iIdx].claimsCount = (db.items[iIdx].claimsCount || 0) + 1;
      db.items[iIdx].status = 'claimed';
    }

    const claim = {
      id: newId('clm_'),
      itemId,
      userId,
      description,
      contact,
      status: 'pending',  // pending | approved | rejected
      createdAt: new Date().toISOString(),
    };
    db.claims.push(claim);
    write(db);
    return claim;
  },

  updateStatus(id, status) {
    const db = read();
    const idx = db.claims.findIndex(c => c.id === id);
    if (idx === -1) return null;
    db.claims[idx].status = status;
    db.claims[idx].updatedAt = new Date().toISOString();

    // If approved → mark item returned
    if (status === 'approved') {
      const iIdx = db.items.findIndex(i => i.id === db.claims[idx].itemId);
      if (iIdx !== -1) db.items[iIdx].status = 'returned';
    }

    write(db);
    return db.claims[idx];
  },

  delete(id) {
    const db = read();
    const idx = db.claims.findIndex(c => c.id === id);
    if (idx === -1) return false;
    db.claims.splice(idx, 1);
    write(db);
    return true;
  },
};

/* ── seed admin on first run ───────────────────── */
function seedAdmin() {
  if (!Users.findByEmail('admin@campus.edu')) {
    // password: admin123
    const hash = require('../utils/crypto').hashPasswordSync('admin123');
    Users.create({
      name: 'Campus Admin',
      email: 'admin@campus.edu',
      passwordHash: hash,
      role: 'admin',
      dept: 'Administration',
    });
    console.log('✅  Seeded admin — email: admin@campus.edu  password: admin123');
  }
  if (!Users.findByEmail('student@campus.edu')) {
    const hash = require('../utils/crypto').hashPasswordSync('student123');
    Users.create({
      name: 'Alex Johnson',
      email: 'student@campus.edu',
      passwordHash: hash,
      role: 'student',
      dept: 'CS — Year 3',
    });
    console.log('✅  Seeded student — email: student@campus.edu  password: student123');
  }
}

module.exports = { Users, Items, Claims, seedAdmin };
