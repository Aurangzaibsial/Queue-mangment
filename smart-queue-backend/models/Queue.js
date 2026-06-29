/**
 * models/Queue.js
 * ─────────────────────────────────────────────
 * Queue model representing a service queue
 * (e.g., "Billing Counter", "Tech Support").
 * Each Queue can have multiple Tokens.
 * ─────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: [100, 'Service name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    // Auto-incremented queue number for display
    queueNumber: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'paused', 'closed'],
        message: 'Status must be active, paused, or closed',
      },
      default: 'active',
    },
    priorityLevel: {
      type: String,
      enum: ['low', 'normal', 'high', 'emergency'],
      default: 'normal',
    },
    category: {
      type: String,
      enum: ['General', 'Support', 'Billing', 'Technical', 'Emergency', 'VIP'],
      default: 'General',
    },
    // Maximum allowed tokens in this queue at once
    maxCapacity: {
      type: Number,
      default: 100,
      min: [1, 'Max capacity must be at least 1'],
    },
    // Estimated service time in minutes per customer
    estimatedServiceTime: {
      type: Number,
      default: 5,
      min: [1, 'Service time must be at least 1 minute'],
    },
    // Which admin/counter manages this queue
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Analytics: track historical data
    analytics: {
      totalServed: { type: Number, default: 0 },
      totalSkipped: { type: Number, default: 0 },
      avgActualServiceTime: { type: Number, default: 0 }, // Updated by AI engine
      peakHour: { type: Number, default: null }, // 0-23
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

// ── Virtual: Current queue length (from Token model) ──
QueueSchema.virtual('currentLength', {
  ref: 'Token',
  localField: '_id',
  foreignField: 'queueId',
  count: true,
  match: { status: 'waiting' },
});

// ── Indexes ──────────────────────────────────────
QueueSchema.index({ businessId: 1, status: 1 });
QueueSchema.index({ businessId: 1, category: 1 });
QueueSchema.index({ managedBy: 1 });

module.exports = mongoose.model('Queue', QueueSchema);
