/**
 * routes/businessRoutes.js
 * ─────────────────────────────────────────────
 * Routes for business onboarding and management.
 * ─────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();
const {
  registerBusiness,
  getMyBusiness,
  updateBusiness,
  getBusinessBySlug,
  getAllBusinesses,
  rateBusiness,
} = require('../controllers/businessController');
const { protect } = require('../middleware/auth');
const { requireBusiness } = require('../middleware/tenantMiddleware');

// Public routes
router.get('/slug/:slug', getBusinessBySlug);
router.get('/all', getAllBusinesses);

// Protected routes (require login)
router.use(protect);

// Register a new business (turns user into owner)
router.post('/register', registerBusiness);
router.post('/:id/rate', rateBusiness);

// Routes requiring an existing business link
router.use('/me', requireBusiness);
router.route('/me')
  .get(getMyBusiness)
  .put(updateBusiness);

module.exports = router;
