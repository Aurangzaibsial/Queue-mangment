/**
 * controllers/businessController.js
 * ─────────────────────────────────────────────
 * Business management, onboarding, and branding.
 * ─────────────────────────────────────────────
 */

const Business = require('../models/Business');
const User = require('../models/User');
const Queue = require('../models/Queue');
const Token = require('../models/Token');
const Review = require('../models/Review');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const aiService = require('../services/aiService');

const getDefaultQueuesForCategory = (category, baseRate = 0) => {
  switch (category) {
    case 'clinic':
      return [
        { serviceName: 'General Consultation', category: 'General', estimatedServiceTime: 12, serviceFee: baseRate || 30, description: 'Routine checkups, vitals and primary doctor consult' },
        { serviceName: 'Express Triage & Diagnostics', category: 'Emergency', estimatedServiceTime: 6, serviceFee: (baseRate || 30) + 15, description: 'Urgent care triage, blood work and rapid tests' },
      ];
    case 'salon':
      return [
        { serviceName: 'Haircut & Styling Desk', category: 'General', estimatedServiceTime: 20, serviceFee: baseRate || 25, description: 'Custom hair styling, trimming, wash and blowdry' },
        { serviceName: 'VIP Treatment & Color Lounge', category: 'VIP', estimatedServiceTime: 35, serviceFee: (baseRate || 25) + 30, description: 'Keratin hair therapy, facial and premium styling' },
      ];
    case 'retail':
      return [
        { serviceName: 'Express Checkout Counter', category: 'General', estimatedServiceTime: 5, serviceFee: 0, description: 'Fast 1-10 items billing queue' },
        { serviceName: 'Customer Support & Returns', category: 'Support', estimatedServiceTime: 8, serviceFee: 0, description: 'Order pickups, refunds and product support' },
      ];
    case 'restaurant':
      return [
        { serviceName: 'Dine-In Table Reservation Queue', category: 'General', estimatedServiceTime: 15, serviceFee: baseRate || 0, description: 'Host desk queue for table seating' },
        { serviceName: 'Express Takeout & Delivery Desk', category: 'General', estimatedServiceTime: 5, serviceFee: 0, description: 'Quick pickup for takeaway orders' },
      ];
    case 'bank':
      return [
        { serviceName: 'Cashier & Deposit Counter', category: 'Billing', estimatedServiceTime: 8, serviceFee: 0, description: 'Cash deposits, withdrawals, utility payments' },
        { serviceName: 'Personal Banker & Accounts', category: 'Technical', estimatedServiceTime: 18, serviceFee: 0, description: 'Account opening, loans, cards and wealth management' },
      ];
    case 'fitness':
      return [
        { serviceName: 'Gym Floor & Workout Check-In', category: 'General', estimatedServiceTime: 5, serviceFee: baseRate || 15, description: 'Access verification and locker assignment' },
        { serviceName: 'Personal Trainer Consultation', category: 'VIP', estimatedServiceTime: 25, serviceFee: (baseRate || 15) + 35, description: 'Body composition analysis & private coaching' },
      ];
    default:
      return [
        { serviceName: 'General Service Desk', category: 'General', estimatedServiceTime: 10, serviceFee: baseRate || 0, description: 'Primary customer service and inquiry queue' },
        { serviceName: 'Express Counter', category: 'Support', estimatedServiceTime: 5, serviceFee: baseRate || 0, description: 'Quick consultations and document processing' },
      ];
  }
};

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
      operatingHours, socialLinks, description, pricing
    } = req.body;

    if (!name) {
      return sendError(res, 400, 'Business name is required');
    }

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

    const bizCategory = category || 'other';

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
      category: bizCategory,
      pricing: pricing || { baseRate: 0, hourlyRate: 0, priceTier: 'standard', currency: 'USD' },
      description,
      ownerId: req.user._id,
      status: 'active',
      isActive: true,
    });

    // Auto-provision initial service queues for this business
    const defaultQueues = getDefaultQueuesForCategory(bizCategory, pricing?.baseRate || 0);
    for (const q of defaultQueues) {
      await Queue.create({
        businessId: business._id,
        serviceName: q.serviceName,
        category: q.category,
        estimatedServiceTime: q.estimatedServiceTime,
        serviceFee: q.serviceFee,
        description: q.description,
        managedBy: req.user._id,
        status: 'active',
        isActive: true,
      });
    }

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
      user: updatedUser.toSafeObject(),
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

/**
 * @route   GET /api/business/all
 * @desc    Get all active businesses for customers to browse
 * @access  Public
 */
exports.getAllBusinesses = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    
    const query = { isActive: true, status: 'active' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tagline: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const businesses = await Business.find(query)
      .select('name slug tagline category city address phone logo primaryColor accentColor description rating pricing aiSettings')
      .sort({ createdAt: -1 });

    // Add AI status to each business
    const enrichedBusinesses = businesses.map(business => ({
      ...business.toObject(),
      aiEnabled: business.aiSettings && (
        business.aiSettings.enableNoshowPrediction ||
        business.aiSettings.enableDemandForecasting ||
        business.aiSettings.enableCapacityOptimization
      ),
      aiFeatures: business.aiSettings ? {
        noshowPrediction: business.aiSettings.enableNoshowPrediction,
        demandForecasting: business.aiSettings.enableDemandForecasting,
        capacityOptimization: business.aiSettings.enableCapacityOptimization
      } : null
    }));
    
    sendSuccess(res, 200, 'Businesses retrieved successfully', enrichedBusinesses);
  } catch (err) {
    next(err);
  }
};

exports.rateBusiness = async (req, res, next) => {
  try {
    const { tokenId, rating, comment = '' } = req.body;
    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return sendError(res, 400, 'Rating must be a whole number from 1 to 5.');
    }

    const token = await Token.findOne({ _id: tokenId, businessId: req.params.id, userId: req.user._id, status: 'completed' });
    if (!token) return sendError(res, 403, 'Only completed tickets from your account can be rated.');

    const review = await Review.create({ businessId: token.businessId, userId: req.user._id, tokenId: token._id, rating: score, comment });
    const ratingStats = await Review.aggregate([
      { $match: { businessId: token.businessId } },
      { $group: { _id: '$businessId', average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const stats = ratingStats[0] || { average: 0, count: 0 };
    await Business.findByIdAndUpdate(token.businessId, { 'rating.average': Number(stats.average.toFixed(1)), 'rating.count': stats.count });

    return sendSuccess(res, 201, 'Thank you for rating this business.', { review, rating: { average: Number(stats.average.toFixed(1)), count: stats.count } });
  } catch (error) {
    if (error.code === 11000) return sendError(res, 409, 'This ticket has already been rated.');
    next(error);
  }
};
