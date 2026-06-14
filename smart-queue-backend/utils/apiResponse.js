/**
 * utils/apiResponse.js
 * ─────────────────────────────────────────────
 * Standardized API response formatters.
 * Ensures consistent response shape across all endpoints.
 *
 * Success: { success: true, message, data, meta? }
 * Error:   { success: false, message, errors? }
 * ─────────────────────────────────────────────
 */

/**
 * Send a success response
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Human-readable message
 * @param {*} data - Response payload
 * @param {object} meta - Optional pagination/meta info
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Array} errors - Validation errors array
 */
const sendError = (res, statusCode = 500, message = 'Internal Server Error', errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Paginated response helper
 */
const sendPaginated = (res, data, page, limit, total) => {
  return sendSuccess(res, 200, 'Data retrieved successfully', data, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    pages: Math.ceil(total / limit),
  });
};

module.exports = { sendSuccess, sendError, sendPaginated };
