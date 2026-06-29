/**
 * middleware/auth.js
 * ─────────────────────────────────────────────
 * JWT Authentication & Role-based Authorization.
 *
 * Usage:
 *   router.get('/route', protect, adminOnly, handler)
 *   router.get('/route', protect, authorize('admin','superadmin'), handler)
 * ─────────────────────────────────────────────
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * protect — Verifies JWT and attaches user to req.user
 * Supports token via Authorization header or cookie.
 */
const protect = async (req, res, next) => {
  let token;

  // Extract from Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Fallback: cookie (for browser clients)
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, 401, 'Access denied. No token provided.');
  }

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach fresh user document to request
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return sendError(res, 401, 'Token is valid but user no longer exists.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account has been deactivated.');
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn(`Auth middleware JWT error: ${error.message}`);

    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Session expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 401, 'Invalid token. Please log in again.');
    }
    return sendError(res, 401, 'Authentication failed.');
  }
};

/**
 * authorize — Role-based access control factory.
 * Pass allowed roles as arguments.
 *
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'superadmin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Not authenticated.');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied. This route requires role: ${roles.join(' or ')}`
      );
    }

    next();
  };
};

// Convenience shortcuts
const ownerOnly = authorize('owner', 'superadmin');
const adminOnly = authorize('admin', 'owner', 'superadmin');
const superAdminOnly = authorize('superadmin');

/**
 * optionalAuth — Attaches user if token present, but doesn't block.
 * Useful for routes that behave differently for authenticated users.
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch {
      // Silently ignore invalid token for optional auth
    }
  }

  next();
};

module.exports = { protect, authorize, adminOnly, superAdminOnly, optionalAuth };
