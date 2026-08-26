/**
 * routes/aiAnalyticsRoutes.js
 * ─────────────────────────────────────────────
 * AI Analytics routes for business dashboard
 * ─────────────────────────────────────────────
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  getBusinessAnalytics,
  getDemandForecast,
  getTenantProfile,
  updateTenantProfile,
  retrainModel,
  checkAIHealth,
  updateAISettings,
  getAIStatus,
  getBusinessRecommendations,
  customerAssistant,
  ownerSummary,
  businessSuggestions,
  queueExplanation,
  notificationDraft
} = require('../controllers/aiAnalyticsController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// ── PUBLIC / OPTIONAL AUTH ROUTES ──────────────
// POST /api/ai/recommendations — accessible to anyone (guest or logged-in)
router.post('/recommendations', optionalAuth, getBusinessRecommendations);
router.post('/assistant', optionalAuth, customerAssistant);
router.post('/business-suggestions', optionalAuth, businessSuggestions);

// All routes below require authentication
router.use(protect);

// ── GET /api/ai/status ─────────────────────────
// Public endpoint for all authenticated users to check AI availability
router.get('/status', getAIStatus);
router.post('/owner-summary', authorize('owner', 'admin'), ownerSummary);
router.post('/queue-explanation', authorize('owner', 'admin'), queueExplanation);
router.post('/notification-draft', authorize('owner', 'admin'), notificationDraft);

// ── GET /api/ai/analytics ─────────────────────
router.get('/analytics', authorize('owner', 'admin'), getBusinessAnalytics);

// ── GET /api/ai/demand-forecast ────────────────
router.get('/demand-forecast', authorize('owner', 'admin'), getDemandForecast);

// ── GET /api/ai/tenant-profile ──────────────────
router.get('/tenant-profile', authorize('owner', 'admin'), getTenantProfile);

// ── POST /api/ai/tenant-profile/update ─────────
router.post('/tenant-profile/update', authorize('owner', 'admin'), updateTenantProfile);

// ── POST /api/ai/retrain-model ─────────────────
router.post(
  '/retrain-model',
  authorize('owner', 'superadmin'),
  [
    body('modelType').isIn(['duration', 'wait', 'noshow', 'demand', 'availability'])
      .withMessage('Invalid model type')
  ],
  retrainModel
);

// ── GET /api/ai/health ─────────────────────────
router.get('/health', checkAIHealth);

// ── PUT /api/ai/settings ───────────────────────
router.put(
  '/settings',
  authorize('owner', 'admin'),
  [
    body('enableNoshowPrediction').optional().isBoolean(),
    body('enableDemandForecasting').optional().isBoolean(),
    body('enableCapacityOptimization').optional().isBoolean()
  ],
  updateAISettings
);

module.exports = router;
