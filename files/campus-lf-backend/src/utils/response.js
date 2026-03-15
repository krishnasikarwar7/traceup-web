/**
 * response.js — Consistent JSON response helpers
 */

function ok(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function created(res, data = {}, message = 'Created') {
  return ok(res, data, message, 201);
}

function error(res, message = 'An error occurred', statusCode = 400, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function notFound(res, message = 'Resource not found') {
  return error(res, message, 404);
}

function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401);
}

function forbidden(res, message = 'Forbidden — insufficient permissions') {
  return error(res, message, 403);
}

function serverError(res, err) {
  console.error('[Server Error]', err);
  return error(res, 'Internal server error', 500);
}

module.exports = { ok, created, error, notFound, unauthorized, forbidden, serverError };
