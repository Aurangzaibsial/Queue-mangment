/**
 * models/Business.js
 * ─────────────────────────────────────────────
 * Business (Organization) model for multi-tenant support.
 * Each business is one organization/company that uses the platform.
 * 
 * PHASE 1: Core multi-tenant foundation
 * - Stores business info (name, owner)
 * - Future: will add subscription, branding, settings
 * ─────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema(
  {
    // Business identification
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    
    // URL-safe slug for subdomain/multi-domain support (future)
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'],
    },
    
    // Contact info
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    
    phone: {
      type: String,
      trim: true,
    },
    
    // Business owner (user who created this business)
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Basic info
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    
    // Status tracking
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended', 'cancelled'],
        message: 'Status must be active, suspended, or cancelled',
      },
      default: 'active',
    },
    
    // FUTURE: Branding (Phase 2+)
    // logo: String,
    // primaryColor: String,
    // secondaryColor: String,
    
    // FUTURE: Subscription (Phase 3)
    // subscriptionPlan: String,
    // subscriptionStatus: String,
    // billingCycleStart: Date,
    // billingCycleEnd: Date,
    
    // FUTURE: Settings (Phase 2+)
    // timezone: String,
    // openingHours: Object,
    
    // Track when business was created and last updated
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────
BusinessSchema.index({ slug: 1 });
BusinessSchema.index({ ownerId: 1 });
BusinessSchema.index({ status: 1 });

module.exports = mongoose.model('Business', BusinessSchema);
