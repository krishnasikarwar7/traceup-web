/**
 * validate.js — simple validation helpers, no external deps
 */

const { error } = require('../utils/response');

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isDate(str) {
  return !isNaN(Date.parse(str));
}

/**
 * validate(schema) — returns middleware that checks req.body fields
 * schema: { fieldName: { required, type, minLen, maxLen, isEmail, isDate, enum } }
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body[field];
      const empty = val === undefined || val === null || String(val).trim() === '';

      if (rules.required && empty) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }
      if (empty) continue; // optional field not provided — skip remaining checks

      const str = String(val).trim();

      if (rules.minLen && str.length < rules.minLen)
        errors.push({ field, message: `${field} must be at least ${rules.minLen} characters` });

      if (rules.maxLen && str.length > rules.maxLen)
        errors.push({ field, message: `${field} must be at most ${rules.maxLen} characters` });

      if (rules.isEmail && !isEmail(str))
        errors.push({ field, message: `${field} must be a valid email address` });

      if (rules.isDate && !isDate(str))
        errors.push({ field, message: `${field} must be a valid date` });

      if (rules.enum && !rules.enum.includes(str))
        errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
    }

    if (errors.length > 0)
      return error(res, 'Validation failed', 422, errors);

    // Sanitize: trim all string body fields
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') req.body[key] = req.body[key].trim();
    }

    next();
  };
}

/* Pre-built schemas */
const schemas = {
  register: {
    name:     { required: true, minLen: 2,  maxLen: 80 },
    email:    { required: true, isEmail: true },
    password: { required: true, minLen: 6, maxLen: 100 },
  },
  login: {
    email:    { required: true, isEmail: true },
    password: { required: true },
  },
  item: {
    type:        { required: true, enum: ['lost', 'found'] },
    name:        { required: true, minLen: 2, maxLen: 120 },
    category:    { required: true },
    location:    { required: true, minLen: 3, maxLen: 200 },
    date:        { required: true, isDate: true },
    description: { required: true, minLen: 10, maxLen: 2000 },
  },
  claim: {
    description: { required: true, minLen: 20, maxLen: 1000 },
  },
};

module.exports = { validate, schemas };
