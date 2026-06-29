/**
 * controllers/businessController.js
 * ─────────────────────────────────────────────
 * Business management, onboarding, and branding.
 * ─────────────────────────────────────────────
 */

const Business = require('../models/Business');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * @route   POST /api/business/register
 * @desc    Register a new business and make user owner
 * @access  Private
 */
exports.registerBusiness = async (req, res, next) => {
  try {
    const { 
      name, slug: customSlug, category, tagline, about, email, phone, website,
      address, city, state, country, zipCode, primaryColor, secondaryColor, accentColor,
      operatingHours, socialLinks, description
    } = req.body;

    if (!name) {
      return sendError(res, 400, 'Business name is required');
    }

    // Check if user already owns a business (commented out for testing/flexibility)
    // if (req.user.businessId) {
    //   return sendError(res, 400, 'User already has a registered business');
    // }

    // Generate slug: use customSlug if provided, otherwise fallback to name
    let baseSlug = '';
    if (customSlug) {
      baseSlug = customSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    
    if (!baseSlug) {
      baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    
    // Absolute fallback in case name or customSlug consists entirely of non-latin characters
    if (!baseSlug) {
      baseSlug = 'business-' + Math.random().toString(36).substring(2, 8);
    }

    let slug = baseSlug;
    let counter = 1;
    
    // Ensure unique slug
    while (await Business.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const business = await Business.create({
      name,
      slug,
      tagline,
      about,
      email: email || req.user.email,
      phone,
      website,
      address,
      city,
      state,
      country,
      zipCode,
      primaryColor,
      secondaryColor,
      accentColor,
      operatingHours,
      socialLinks,
      category: category || 'other',
      description,
      ownerId: req.user._id,
    });

    // Update user to owner and link business
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { 
        role: 'owner',
        businessId: business._id 
      },
      { new: true, runValidators: true }
    );

    sendSuccess(res, 201, 'Business registered successfully', {
      business,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        businessId: updatedUser.businessId,
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/business/me
 * @desc    Get my business details (all fields)
 * @access  Private (Owner/Admin)
 */
exports.getMyBusiness = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId);
    if (!business) {
      return sendError(res, 404, 'Business not found');
    }
    sendSuccess(res, 200, 'Business details retrieved', business);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PUT /api/business/me
 * @desc    Update business info, branding, settings
 * @access  Private (Owner/Admin)
 */
exports.updateBusiness = async (req, res, next) => {
  try {
    // Only allow updating certain fields (prevent changing ownerId, slug, plan, etc.)
    const allowedFields = [
      'name', 'tagline', 'about', 'category', 'description',
      'logo', 'bannerImage', 'favicon', 'primaryColor', 'secondaryColor', 'accentColor', 'fontFamily',
      'email', 'phone', 'website', 'supportEmail',
      'address', 'city', 'state', 'country', 'zipCode', 'coordinates',
      'socialLinks', 'operatingHours', 'timezone', 'currency', 'language', 'autoCloseQueues',
      'customFields'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    sendSuccess(res, 200, 'Business updated successfully', business);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/business/slug/:slug
 * @desc    Get public business info by slug (for booking page)
 * @access  Public
 */
exports.getBusinessBySlug = async (req, res, next) => {
  try {
    const business = await Business.findOne({ slug: req.params.slug, isActive: true, status: 'active' })
      .select('-ownerId -__v'); // Exclude sensitive fields
      
    if (!business) {
      return sendError(res, 404, 'Business not found');
    }
    sendSuccess(res, 200, 'Business details retrieved', business);
  } catch (err) {
    next(err);
  }
};
