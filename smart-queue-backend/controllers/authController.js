/**
 * controllers/authController.js
 * ─────────────────────────────────────────────
 * Authentication controller.
 * Handles user registration, login, and profile.
 * Uses JWT for stateless auth.
 * ─────────────────────────────────────────────
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Generate a signed JWT for a user ID.
 * @param {string} id - User MongoDB ObjectId
 * @returns {string} JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// ── POST /api/auth/register ─────────────────────
/**
 * Register a new user account.
 * Body: { name, email, password, role? }
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Prevent direct superadmin creation via public API
    const safeRole = role === 'superadmin' ? 'user' : (role || 'user');

    // Create user (password hashed in pre-save hook)
    const user = await User.create({ name, email, password, role: safeRole });

    const token = generateToken(user._id);

    logger.info(`New user registered: ${email} (${safeRole})`);

    return sendSuccess(res, 201, 'Account created successfully', {
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/login ─────────────────────────
/**
 * Log in an existing user.
 * Body: { email, password }
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Explicitly select password (excluded by default in schema)
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account has been deactivated. Contact support.');
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    logger.info(`User logged in: ${email}`);

    return sendSuccess(res, 200, 'Login successful', {
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ─────────────────────────────
/**
 * Get current authenticated user's profile.
 * Requires: protect middleware
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    sendSuccess(res, 200, 'User profile retrieved', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/me ─────────────────────────────
/**
 * Update current user's name or phone.
 * Does NOT allow role/email changes here.
 */
exports.updateMe = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return sendSuccess(res, 200, 'Profile updated', user.toSafeObject());
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/auth/change-password ────────────────
/**
 * Change password for authenticated user.
 * Body: { currentPassword, newPassword }
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return sendError(res, 401, 'Current password is incorrect.');
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id);
    return sendSuccess(res, 200, 'Password changed successfully', { token });
  } catch (error) {
    next(error);
  }
};
