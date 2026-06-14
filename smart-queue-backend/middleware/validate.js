/**
 * middleware/validate.js
 * ─────────────────────────────────────────────
 * Validation middleware using express-validator.
 * Collects validation errors and returns a clean
 * 422 response if any fail.
 * ─────────────────────────────────────────────
 */

const { validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

/**
 * validate — Run after express-validator chains.
 * Returns 422 Unprocessable Entity if validation fails.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors: [{ field, message }]
    const formatted = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return sendError(res, 422, 'Validation failed', formatted);
  }

  next();
};

module.exports = validate;
