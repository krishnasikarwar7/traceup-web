# 🔍 Campus Lost & Found Portal — Backend

A complete **Node.js + Express + MongoDB** REST API backend for the TraceUp (Lost & Found Portal) web application.

---

## 📁 Project Structure

```
campus-lost-found-backend/
├── server.js                  # Entry point — Express app + middleware + routes
├── package.json
├── .env.example               # Copy to .env and fill in your values
│
├── config/
│   └── db.js                  # MongoDB connection (Mongoose)
│
├── models/
│   ├── User.js                # User DB operations (create, findByEmail, verify…)
│   ├── Item.js                # Item DB operations (CRUD, filters, stats…)
│   └── Claim.js               # Claim DB operations (create, approve, reject…)
│
├── controllers/
│   ├── authController.js      # register, login, getProfile, updateProfile
│   ├── itemController.js      # getItems, getItemById, createItem, updateItem, deleteItem
│   ├── claimController.js     # createClaim, getUserClaims, getItemClaims
│   └── adminController.js     # getAllItems, approveClaim, rejectClaim, markReturned…
│
├── routes/
│   ├── authRoutes.js          # /api/auth/*
│   ├── itemRoutes.js          # /api/items/*
│   ├── claimRoutes.js         # /api/claims/*
│   └── adminRoutes.js         # /api/admin/*
│
├── middleware/
│   ├── authMiddleware.js      # protect() — verify JWT, attach req.user
│   ├── adminMiddleware.js     # adminOnly(), adminOrOwner()
│   └── uploadMiddleware.js    # handleUpload (Multer), deleteFile
│
├── uploads/                   # Uploaded images stored here
├── sql/
│   └── schema.sql             # Legacy SQL schema (kept for reference)
└── public/                    # Frontend HTML/CSS/JS files (served statically)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v18+ 

### 2. Install dependencies
```bash
npm install
```

### 3. Database
This project uses **MongoDB**. You must have MongoDB installed locally or use a MongoDB Atlas URI.
To seed the database with initial users and items, run:
```bash
node seed-mongo.js
```

### 4. Configure environment
```bash
cp .env.example .env
# Edit .env with your JWT secret and other config.
```

**.env example:**
```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/traceup
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5500
```

### 5. Start the server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Server starts at: **http://localhost:3000**

---

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create new account |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/profile` | ✅ JWT | Get current user profile |
| PUT | `/api/auth/profile` | ✅ JWT | Update profile |

### Items
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/items` | — | List items (filterable) |
| GET | `/api/items/stats` | — | Dashboard counts |
| GET | `/api/items/my` | ✅ JWT | Items by logged-in user |
| GET | `/api/items/:id` | — | Single item detail |
| POST | `/api/items` | ✅ JWT | Report new item (multipart) |
| PUT | `/api/items/:id` | ✅ JWT | Update item |
| DELETE | `/api/items/:id` | ✅ JWT | Delete item |

**Query parameters for GET /api/items:**
- `type` — `lost` or `found`
- `status` — `lost`, `found`, `claimed`, `returned`
- `category` — any category string
- `q` — keyword search (title, description, location)
- `page` — page number (default: 1)
- `limit` — items per page (default: 20)
- `sort` — `newest`, `oldest`, `az`, `za`, `date`

### Claims
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/claims` | ✅ JWT | Submit a claim |
| GET | `/api/claims/user` | ✅ JWT | Get my claims |
| GET | `/api/claims/item/:itemId` | ✅ JWT | Claims for an item (owner/admin) |

### Admin (role: admin required)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | 🔐 Admin | Dashboard statistics |
| GET | `/api/admin/items` | 🔐 Admin | All items + claim counts |
| PUT | `/api/admin/items/:id/status` | 🔐 Admin | Change item status |
| PUT | `/api/admin/items/:id/return` | 🔐 Admin | Mark as returned |
| DELETE | `/api/admin/items/:id` | 🔐 Admin | Delete any item |
| GET | `/api/admin/claims` | 🔐 Admin | All claims |
| PUT | `/api/admin/claims/:id/approve` | 🔐 Admin | Approve claim |
| PUT | `/api/admin/claims/:id/reject` | 🔐 Admin | Reject claim |
| GET | `/api/admin/users` | 🔐 Admin | All users |

---

## 🔐 Authentication

All protected routes require:
```
Authorization: Bearer <your_jwt_token>
```

Get the token from `/api/auth/login` response.

---

## 📤 File Upload

Item images use `multipart/form-data`. Send the image as field `image`.

```js
const formData = new FormData();
formData.append('title', 'MacBook Pro');
formData.append('type', 'lost');
formData.append('category', 'Electronics');
formData.append('location', 'Main Library');
formData.append('date_lost', '2026-03-10');
formData.append('image', fileInput.files[0]);

fetch('http://localhost:3000/api/items', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

Uploaded images are served at: `http://localhost:3000/uploads/<filename>`

---

## 🌱 Seed Data

The schema includes demo data. Test credentials:

| Email | Password | Role |
|-------|----------|------|
| admin@university.edu | admin123 | admin |
| priya@university.edu | pass1234 | user |
| rohan@university.edu | pass1234 | user |
| sneha@university.edu | pass1234 | user |

---

## 🗄️ Database Schema (Mongoose)

```javascript
User   → name, email, password (bcrypt), role, department, phone
Item   → title, category, description, location, date_lost, image,
         color, brand, reward, type, status, user_id (Ref)
Claim  → item_id (Ref), claimant_id (Ref), message, contact,
         status, admin_note
```

---

## 💡 API Response Format

All responses follow this consistent shape:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 47, "page": 1, "limit": 20, "total_pages": 3 }
}
```

Errors:
```json
{
  "success": false,
  "error": "Human-readable message here"
}
```

Validation errors:
```json
{
  "success": false,
  "errors": [{ "field": "email", "msg": "A valid email address is required." }]
}
```
