/**
 * middleware/uploadMiddleware.js
 *
 * Multer configuration for handling image uploads.
 * Files are stored locally in the /uploads directory.
 *
 * Validates:
 *   - File type: only jpg, jpeg, png, webp, gif
 *   - File size: max 5 MB (configurable via MAX_FILE_SIZE in .env)
 */

'use strict';

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Keep upload destination aligned with server.js static mount (/uploads -> <project-root>/uploads)
const UPLOAD_DIR    = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5 MB default
const ALLOWED_TYPES = /jpeg|jpg|png|webp|gif/;

// Ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Storage engine ────────────────────────────────────────────
// Files are saved as: uploads/<timestamp>-<random>.ext
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),

  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext          = path.extname(file.originalname).toLowerCase();
    cb(null, `item-${uniqueSuffix}${ext}`);
  },
});

// ── File filter ───────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
  const extOk  = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = ALLOWED_TYPES.test(file.mimetype);

  if (extOk && mimeOk) {
    cb(null, true); // accept
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files (jpg, png, webp, gif) are allowed.'));
  }
};

// ── Multer instance ───────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// ── Exported middleware ───────────────────────────────────────

/**
 * Single file upload on field named "image".
 * Attach to routes that accept an image: upload.single('image')
 */
const uploadSingle = upload.single('image');

/**
 * Wrap uploadSingle so Multer errors are formatted as JSON
 * instead of crashing Express with an ugly HTML error page.
 */
const handleUpload = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE:       `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        LIMIT_UNEXPECTED_FILE: err.message || 'Unexpected file field.',
      };
      return res.status(400).json({
        success: false,
        error:   messages[err.code] || err.message,
      });
    }

    // Generic error
    return res.status(400).json({ success: false, error: err.message });
  });
};

/**
 * Helper: delete an uploaded file from disk (used when replacing images).
 * @param {string} filename — just the filename, not the full path
 */
const deleteFile = (filename) => {
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, path.basename(filename));
  fs.unlink(filePath, () => {}); // fire-and-forget, ignore errors
};

module.exports = { handleUpload, deleteFile, UPLOAD_DIR };
