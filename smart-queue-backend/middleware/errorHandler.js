/**
 * middleware/errorHandler.js
 * ─────────────────────────────────────────────
 * Global Express error handling middleware.
 * Catches all errors passed via next(err).
 * Maps Mongoose errors to friendly responses.
 * ─────────────────────────────────────────────
 */

const logger = require('../utils/logger');
const { sendError } = require('../utils/apiResponse');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // ── Mongoose Duplicate Key (e.g., email already exists) ──
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    statusCode = 409;
  }

  // ── Mongoose Validation Error ────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, 422, 'Validation failed', errors);
  }

  // ── Mongoose Cast Error (invalid ObjectId) ────────
  if (err.name === 'CastError') {
    message = `Invalid ${err.path}: ${err.value}`;
    statusCode = 400;
  }

  // ── JWT Errors ────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Token expired. Please log in again.';
    statusCode = 401;
  }

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}] ${statusCode} — ${message}`, { stack: err.stack });
  } else {
    logger.warn(`[${req.method} ${req.originalUrl}] ${statusCode} — ${message}`);
  }

  return sendError(res, statusCode, message);
};

/**
 * notFound — 404 handler for unmatched routes
 */
const notFound = (req, res) => {
  return sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found.`);
};

module.exports = { errorHandler, notFound };
