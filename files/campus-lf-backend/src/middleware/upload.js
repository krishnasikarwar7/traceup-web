/**
 * upload.js
 * Pure-Node multipart/form-data parser for image uploads.
 * No external dependencies.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR  = path.join(__dirname, '../../uploads');
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '10');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * parseMultipart(req) — returns Promise<{ fields, files }>
 * fields: { key: value }
 * files:  { key: { filename, mimetype, data: Buffer, savedPath, url } }
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';

    // If not multipart, return empty (body already parsed by JSON middleware)
    if (!contentType.includes('multipart/form-data')) {
      return resolve({ fields: {}, files: {} });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return reject(new Error('No boundary in multipart'));

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body   = Buffer.concat(chunks);
        const result = parseMultipartBuffer(body, boundary);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function parseMultipartBuffer(body, boundary) {
  const fields = {};
  const files  = {};

  const sep    = Buffer.from(`--${boundary}`);
  const end    = Buffer.from(`--${boundary}--`);
  const CRLF   = Buffer.from('\r\n');
  const DBLCRLF = Buffer.from('\r\n\r\n');

  let offset = 0;

  while (offset < body.length) {
    // find next boundary
    const boundaryIdx = indexOf(body, sep, offset);
    if (boundaryIdx === -1) break;
    offset = boundaryIdx + sep.length;

    // check for end boundary
    if (body.slice(offset, offset + 2).toString() === '--') break;

    // skip CRLF after boundary
    if (body.slice(offset, offset + 2).toString() === '\r\n') offset += 2;

    // find header / body separator
    const headerEnd = indexOf(body, DBLCRLF, offset);
    if (headerEnd === -1) break;

    const headerStr = body.slice(offset, headerEnd).toString('utf8');
    offset = headerEnd + 4; // skip \r\n\r\n

    // find next boundary to know where this part ends
    const nextBound = indexOf(body, sep, offset);
    if (nextBound === -1) break;
    const partBody = body.slice(offset, nextBound - 2); // strip trailing \r\n
    offset = nextBound;

    // parse headers
    const headers = {};
    headerStr.split('\r\n').forEach(line => {
      const colon = line.indexOf(':');
      if (colon === -1) return;
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    });

    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const fileMatch = disposition.match(/filename="([^"]*)"/);
    if (!nameMatch) continue;

    const fieldName = nameMatch[1];
    const fileName  = fileMatch ? fileMatch[1] : null;
    const mimeType  = headers['content-type'] || 'application/octet-stream';

    if (fileName) {
      // It's a file
      if (partBody.length > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`File exceeds ${MAX_FILE_MB}MB limit`);
      }
      if (fileName && !ALLOWED_MIME.has(mimeType)) {
        throw new Error(`File type ${mimeType} not allowed`);
      }

      let savedPath = null;
      let url       = null;
      if (fileName && partBody.length > 0) {
        const ext      = path.extname(fileName).toLowerCase() || '.jpg';
        const saveName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
        savedPath = path.join(UPLOAD_DIR, saveName);
        fs.writeFileSync(savedPath, partBody);
        url = `/uploads/${saveName}`;
      }

      files[fieldName] = { filename: fileName, mimetype: mimeType, size: partBody.length, savedPath, url };
    } else {
      // Regular field
      fields[fieldName] = partBody.toString('utf8');
    }
  }

  return { fields, files };
}

function indexOf(buf, search, start = 0) {
  for (let i = start; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

/**
 * Express middleware — attaches parsed fields + files to req
 */
function uploadMiddleware(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) return next();

  parseMultipart(req)
    .then(({ fields, files }) => {
      req.body  = { ...req.body, ...fields };
      req.files = files;
      next();
    })
    .catch(err => {
      res.status(400).json({ success: false, message: err.message });
    });
}

module.exports = { uploadMiddleware, parseMultipart };
