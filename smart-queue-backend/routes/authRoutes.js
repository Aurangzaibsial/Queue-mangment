/**
 * routes/authRoutes.js
 * ─────────────────────────────────────────────
 * Authentication routes with input validation.
 * ─────────────────────────────────────────────
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ── POST /api/auth/register ──────────────────────
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['user', 'admin']).withMessage('Role must be user or admin'),
  ],
  validate,
  register
);

// ── POST /api/auth/login ─────────────────────────
router.post(
  '/login',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// ── GET /api/auth/me ─────────────────────────────
router.get('/me', protect, getMe);

// ── PUT /api/auth/me ─────────────────────────────
router.put(
  '/me',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  ],
  validate,
  updateMe
);

// ── PUT /api/auth/change-password ────────────────
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  changePassword
);

module.exports = router;
