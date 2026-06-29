/**
 * routes/adminRoutes.js
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const {
  callNext, updateCounter, createCounter, getAnalytics, optimizeQueue, listUsers,
} = require('../controllers/adminController');
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const { requireBusiness } = require('../middleware/tenantMiddleware');
const validate = require('../middleware/validate');

// All admin routes require authentication, admin/owner role, and an active business
router.use(protect, adminOnly, requireBusiness);

// POST /api/admin/call-next
router.post(
  '/call-next',
  [
    body('queueId').isMongoId().withMessage('Valid queue ID is required'),
    body('counterId').isMongoId().withMessage('Valid counter ID is required'),
  ],
  validate,
  callNext
);

// POST /api/admin/counters
router.post(
  '/counters',
  [
    body('counterName').trim().notEmpty().withMessage('Counter name is required'),
    body('counterNumber').isInt({ min: 1 }).withMessage('Counter number must be a positive integer'),
    body('assignedQueue').optional().isMongoId(),
  ],
  validate,
  createCounter
);

// POST /api/admin/update-counter
router.post(
  '/update-counter',
  [
    body('counterId').isMongoId().withMessage('Valid counter ID is required'),
    body('status').optional().isIn(['active', 'inactive', 'break', 'busy']),
    body('averageServiceTime').optional().isFloat({ min: 0.5 }),
  ],
  validate,
  updateCounter
);

// GET /api/admin/analytics
router.get(
  '/analytics',
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be 1–365'),
    query('queueId').optional().isMongoId(),
  ],
  validate,
  getAnalytics
);

// POST /api/admin/optimize
router.post(
  '/optimize',
  [body('queueId').isMongoId().withMessage('Valid queue ID is required')],
  validate,
  optimizeQueue
);

// GET /api/admin/users — superadmin only
router.get('/users', superAdminOnly, listUsers);

module.exports = router;
