/**
 * middleware/tenantMiddleware.js
 * ─────────────────────────────────────────────
 * Multi-tenancy middleware.
 * Injects businessId into the request context for isolated data access.
 * ─────────────────────────────────────────────
 */

const Business = require('../models/Business');
const { sendError } = require('../utils/apiResponse');

/**
 * Helper to get or create a default fallback business
 * Keeps the old frontend working during migration.
 */
const getDefaultBusiness = async () => {
  let business = await Business.findOne({ slug: 'default' });
  if (!business) {
    // Find any superadmin to be the owner
    const User = require('../models/User');
    let owner = await User.findOne({ role: 'superadmin' }) || await User.findOne();
    if (!owner) {
      owner = await User.create({ name: 'System', email: 'system@default.com', password: 'password123', role: 'superadmin' });
    }
    business = await Business.create({
      name: 'Default Business',
      slug: 'default',
      email: 'contact@default.com',
      ownerId: owner._id,
    });
  }
  return business;
};

/**
 * requireBusiness: Ensures the authenticated user is linked to an active business.
 * Sets req.businessId for downstream tenant-scoped queries.
 */
const requireBusiness = async (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    let businessId = req.user.businessId;

    // Backward compatibility fallback
    if (!businessId) {
      const defaultBiz = await getDefaultBusiness();
      businessId = defaultBiz._id;
      // Optionally link the user to this default business so it persists
      req.user.businessId = businessId;
      await req.user.save({ validateModifiedOnly: true });
    }

    const business = await Business.findById(businessId);
    if (!business || business.status !== 'active' || !business.isActive) {
      return sendError(res, 403, 'Business account is inactive or suspended.');
    }
    
    req.businessId = business._id;
    req.business = business;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * resolveBusinessFromSlug: For public endpoints (like booking page).
 * Takes business slug from params, finds businessId, and injects it.
 */
const resolveBusinessFromSlug = async (req, res, next) => {
  try {
    const slug = req.params.slug || req.query.slug || 'default';
    let business = await Business.findOne({ slug, isActive: true, status: 'active' });
    
    // Backward compatibility fallback
    if (!business && slug === 'default') {
      business = await getDefaultBusiness();
    }

    if (!business) {
      return sendError(res, 404, 'Business not found or inactive.');
    }
    
    req.businessId = business._id;
    req.business = business;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireBusiness,
  resolveBusinessFromSlug
};
