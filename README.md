# TraceUp

TraceUp is a full-stack campus lost-and-found portal built with **Node.js + Express + Supabase (PostgreSQL)** and a responsive vanilla HTML/CSS/JS frontend.

It supports:
- user authentication (JWT)
- lost/found item reporting with image upload
- claim workflow with admin approval/rejection
- private finder-claimer chat with Supabase Realtime
- admin controls for items, claims, users, and chat review

---

## Features

- Lost and found item reporting
- Image upload (`jpg`, `jpeg`, `png`, `webp`, `gif`)
- Search/filter by status/type/category/location
- Claim submission with ownership message
- Admin moderation for claims and items
- Private chat between finder and claimer
- Read receipts in chat (`sent` / `seen`)
- Realtime chat updates via Supabase `postgres_changes`
- Responsive UI with dark/light theme toggle

---

## Tech Stack

- Backend: Node.js, Express
- Database: Supabase PostgreSQL
- Realtime: Supabase Realtime
- Auth: JWT (`jsonwebtoken`) + bcrypt password hashing
- Validation: `express-validator`
- File upload: `multer`
- Frontend: Vanilla HTML/CSS/JS (served by Express)

---

## Project Structure

```text
.
├── server.js
├── package.json
├── uploads/                  # runtime uploads directory
├── files/
│   ├── .env.example
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── public/               # frontend pages + assets
│   ├── routes/
│   ├── sql/
│   │   └── schema.sql
│   └── seed.js
└── README.md
```


---

## Frontend Pages

- `index.html` (landing)
- `login.html` (sign in / sign up / password reset)
- `dashboard.html`
- `item-details.html`
- `report-lost.html`
- `report-found.html`
- `chat.html`
- `admin.html`
- `admin-chats.html`

---

## Prerequisites

- Node.js `>= 18`
- npm
- Supabase project (URL, service key, anon key, JWT secret)

---

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp files/.env.example files/.env
```

3. Fill `files/.env` with real values.

4. Apply database schema in Supabase SQL Editor:
- Open `files/sql/schema.sql`
- Run the full file in your Supabase project

5. Start app:

```bash
npm run dev
```

or

```bash
npm start
```

6. Open:

```text
http://localhost:3000
```

---

## Environment Variables

All environment variables are loaded from `files/.env`.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default `3000`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key used by backend |
| `SUPABASE_ANON_KEY` | For realtime chat | Public anon key for browser realtime client |
| `SUPABASE_JWT_SECRET` | For realtime chat | Supabase JWT secret for signing realtime tokens |
| `JWT_SECRET` | Yes | App JWT secret (use strong 32+ chars in production) |
| `JWT_EXPIRES_IN` | No | JWT expiry (default commonly `7d`) |
| `UPLOAD_DIR` | No | Upload folder (default `uploads`) |
| `MAX_FILE_SIZE` | No | Upload max bytes (default `5242880`) |
| `FRONTEND_URL` | Yes in production | Allowed CORS origin(s), comma-separated |

---

## Database Schema

Defined in `files/sql/schema.sql`.

Main tables:
- `users`
- `items`
- `claims`
- `conversations`
- `messages`

Chat-specific constraints and policies:
- one conversation per `(item_id, claimer_id)`
- RLS enabled on `conversations` and `messages`
- finder + claimer + admin access rules
- realtime publication includes `conversations` and `messages`

---

## Seed Data (Optional)

Use the seed script only for dev/testing. It clears existing `claims`, `items`, and `users`.

```bash
node files/seed.js
```
## Available Scripts

```bash
npm run dev       # start with nodemon
npm start         # start server
npm run start:prod
```

---

## API Overview

Base URL: `/api`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/profile` (protected)
- `PUT /auth/profile` (protected)
- `GET /auth/security-question/:email`
- `POST /auth/reset-password-security`

### Items
- `GET /items`
- `GET /items/stats`
- `GET /items/:id`
- `GET /items/my` (protected)
- `POST /items` (protected, multipart `image`)
- `PUT /items/:id` (protected)
- `DELETE /items/:id` (protected)

### Claims
- `POST /claims` (protected)
- `GET /claims/user` (protected)
- `GET /claims/item/:itemId` (protected, owner/admin)

### Chat
- `GET /chat/my` (protected)
- `GET /chat/realtime-auth` (protected)
- `GET /chat/conversations/:conversationId` (protected)
- `GET /chat/conversations/:conversationId/messages` (protected)
- `POST /chat/conversations/:conversationId/messages` (protected)
- `PATCH /chat/conversations/:conversationId/read` (protected)

### Admin
- `GET /admin/stats` (admin)
- `GET /admin/items` (admin)
- `PUT /admin/items/:id/status` (admin)
- `PUT /admin/items/:id/return` (admin)
- `DELETE /admin/items/:id` (admin)
- `GET /admin/claims` (admin)
- `PUT /admin/claims/:id/approve` (admin)
- `PUT /admin/claims/:id/reject` (admin)
- `GET /admin/users` (admin)
- `GET /admin/chats` (admin)
- `GET /admin/chats/:conversationId/messages` (admin)

### Health
- `GET /health`

---

## Realtime Chat Notes

Realtime chat requires:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`

If these are missing, realtime auth endpoint returns a configuration error and realtime updates will not work.

---

## Deployment

You can deploy the app as a single Node service (backend + static frontend).

### Required production env vars
- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET` (strong secret)
- `FRONTEND_URL` (your domain, comma-separated if multiple)
- For chat realtime: `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`

### Start command

```bash
npm run start:prod
```

---

## Troubleshooting

### `Missing SUPABASE_URL or SUPABASE_SERVICE_KEY`
Set both in `files/.env` (or your host env panel).

### CORS issues in production
Set `FRONTEND_URL` correctly, including protocol (`https://...`).

### Realtime chat not connecting
Set `SUPABASE_ANON_KEY` and `SUPABASE_JWT_SECRET`, and ensure `files/sql/schema.sql` chat publication/RLS blocks were applied.

### Upload problems
Check `UPLOAD_DIR` exists and write permissions are available.

---

## Security Notes

- Never commit `.env` or secrets.
- Use strong `JWT_SECRET` in production.
- `SUPABASE_SERVICE_KEY` is server-only; never expose in frontend code.
- Keep `files/sql/schema.sql` RLS policies enabled for chat privacy.

---

## License

Add your preferred license file (for example `MIT`) before publishing publicly.

