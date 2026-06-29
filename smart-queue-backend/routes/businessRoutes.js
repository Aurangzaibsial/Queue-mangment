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
} = require('../controllers/businessController');
const { protect } = require('../middleware/auth');
const { requireBusiness } = require('../middleware/tenantMiddleware');

// Public route for customer booking page
router.get('/slug/:slug', getBusinessBySlug);

// Protected routes (require login)
router.use(protect);

// Register a new business (turns user into owner)
router.post('/register', registerBusiness);

// Routes requiring an existing business link
router.use('/me', requireBusiness);
router.route('/me')
  .get(getMyBusiness)
  .put(updateBusiness);

module.exports = router;
