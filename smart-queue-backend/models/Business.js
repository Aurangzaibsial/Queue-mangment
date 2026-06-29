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
    // ── IDENTITY ──────────────────────────────
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'],
    },
    tagline: { type: String, trim: true, maxlength: 150 },
    about: { type: String, trim: true, maxlength: 2000 },

    // ── BRANDING ──────────────────────────────
    logo: { type: String, default: null },
    bannerImage: { type: String, default: null },
    favicon: { type: String, default: null },
    primaryColor: { type: String, default: '#0F172A' },
    secondaryColor: { type: String, default: '#3B82F6' },
    accentColor: { type: String, default: '#10B981' },
    fontFamily: { type: String, default: 'DM Sans' },

    // ── CONTACT ───────────────────────────────
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    supportEmail: { type: String, trim: true },

    // ── LOCATION ──────────────────────────────
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // ── SOCIAL LINKS ──────────────────────────
    socialLinks: {
      facebook:  { type: String, default: '' },
      instagram: { type: String, default: '' },
      twitter:   { type: String, default: '' },
      linkedin:  { type: String, default: '' },
      whatsapp:  { type: String, default: '' },
      tiktok:    { type: String, default: '' },
      youtube:   { type: String, default: '' },
    },

    // ── OPERATING HOURS ──────────────────────
    operatingHours: {
      monday:    { open: { type: String, default: "09:00" }, close: { type: String, default: "17:00" }, isClosed: { type: Boolean, default: false } },
      tuesday:   { open: { type: String, default: "09:00" }, close: { type: String, default: "17:00" }, isClosed: { type: Boolean, default: false } },
      wednesday: { open: { type: String, default: "09:00" }, close: { type: String, default: "17:00" }, isClosed: { type: Boolean, default: false } },
      thursday:  { open: { type: String, default: "09:00" }, close: { type: String, default: "17:00" }, isClosed: { type: Boolean, default: false } },
      friday:    { open: { type: String, default: "09:00" }, close: { type: String, default: "17:00" }, isClosed: { type: Boolean, default: false } },
      saturday:  { open: { type: String, default: "10:00" }, close: { type: String, default: "15:00" }, isClosed: { type: Boolean, default: true } },
      sunday:    { open: { type: String, default: "10:00" }, close: { type: String, default: "15:00" }, isClosed: { type: Boolean, default: true } },
    },

    // ── SETTINGS ──────────────────────────────
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    language: { type: String, default: 'en' },
    autoCloseQueues: { type: Boolean, default: false },

    // ── SUBSCRIPTION ──────────────────────────
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    limits: {
      maxQueues: { type: Number, default: 2 },
      maxCounters: { type: Number, default: 3 },
      maxTokensPerDay: { type: Number, default: 50 },
    },

    // ── BUSINESS CATEGORY ─────────────────────
    category: {
      type: String,
      enum: ['restaurant', 'clinic', 'salon', 'bank', 'government', 'retail', 'education', 'fitness', 'other'],
      default: 'other',
    },

    // ── CUSTOM FIELDS ─────────────────────────
    customFields: [{
      label: { type: String, trim: true, maxlength: 50 },
      value: { type: String, trim: true, maxlength: 200 },
    }],

    // ── SYSTEM ────────────────────────────────
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended', 'cancelled'],
        message: 'Status must be active, suspended, or cancelled',
      },
      default: 'active',
    },
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
