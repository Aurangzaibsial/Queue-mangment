/**
 * routes/tokenRoutes.js
 */
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const { bookToken, getToken, getUserTokens, cancelToken } = require('../controllers/tokenController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// POST /api/token/book
router.post(
  '/book',
  protect,
  [
    body('queueId').isMongoId().withMessage('Valid queue ID is required'),
    body('priority').optional().isIn(['normal', 'vip', 'emergency']).withMessage('Invalid priority'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes too long'),
    body('customerName').optional().trim().isLength({ max: 60 }),
  ],
  validate,
  bookToken
);

// GET /api/token/user/:userId
router.get(
  '/user/:userId',
  protect,
  [param('userId').isMongoId().withMessage('Invalid user ID')],
  validate,
  getUserTokens
);

// GET /api/token/:id
router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid token ID')],
  validate,
  getToken
);

// DELETE /api/token/:id/cancel
router.delete(
  '/:id/cancel',
  protect,
  [param('id').isMongoId()],
  validate,
  cancelToken
);

module.exports = router;
