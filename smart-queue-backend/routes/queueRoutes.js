/**
 * routes/queueRoutes.js
 */
const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();

const {
  createQueue, listQueues, getQueue, updateQueue, deleteQueue,
} = require('../controllers/queueController');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Public: list and get queues
router.get('/list', listQueues);
router.get('/:id', [param('id').isMongoId().withMessage('Invalid queue ID')], validate, getQueue);

// Admin: create, update, delete
router.post(
  '/create',
  protect, adminOnly,
  [
    body('serviceName').trim().notEmpty().withMessage('Service name is required').isLength({ max: 100 }),
    body('category').isIn(['General', 'Support', 'Billing', 'Technical', 'Emergency', 'VIP']).withMessage('Invalid category'),
    body('estimatedServiceTime').optional().isInt({ min: 1 }).withMessage('Service time must be a positive integer'),
    body('maxCapacity').optional().isInt({ min: 1 }).withMessage('Max capacity must be a positive integer'),
  ],
  validate,
  createQueue
);

router.put(
  '/:id',
  protect, adminOnly,
  [param('id').isMongoId()],
  validate,
  updateQueue
);

router.delete('/:id', protect, adminOnly, [param('id').isMongoId()], validate, deleteQueue);

module.exports = router;
