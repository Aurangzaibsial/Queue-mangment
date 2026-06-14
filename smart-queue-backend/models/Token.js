/**
 * models/Token.js
 * ─────────────────────────────────────────────
 * Token model — represents a single customer's
 * queue ticket. Stores position, wait time, and
 * lifecycle status.
 * ─────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema(
  {
    // Human-readable token number (e.g., "B-042")
    tokenNumber: {
      type: String,
      required: true,
      trim: true,
    },
    // The customer who holds this token
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The queue this token belongs to
    queueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Queue',
      required: true,
    },
    // The counter currently serving this token (if status = serving)
    assignedCounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceCounter',
      default: null,
    },
    // Queue position (1-based, dynamically updated)
    position: {
      type: Number,
      required: true,
      min: 1,
    },
    // AI-predicted wait time in minutes
    estimatedWaitTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Actual time taken to serve (set on completion)
    actualWaitTime: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['waiting', 'serving', 'completed', 'skipped', 'cancelled'],
        message: 'Invalid token status',
      },
      default: 'waiting',
    },
    // Priority affects sorting within queue
    priority: {
      type: String,
      enum: ['normal', 'vip', 'emergency'],
      default: 'normal',
    },
    // Customer metadata
    customerName: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['General', 'Support', 'Billing', 'Technical', 'Emergency', 'VIP'],
      default: 'General',
    },
    // When this token was called (status changed to serving)
    calledAt: {
      type: Date,
      default: null,
    },
    // When service was completed
    completedAt: {
      type: Date,
      default: null,
    },
    // Notes from admin
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true, // createdAt = time customer joined queue
    toJSON: { virtuals: true },
  }
);

// ── Indexes for common queries ───────────────────
TokenSchema.index({ queueId: 1, status: 1 });
TokenSchema.index({ userId: 1 });
TokenSchema.index({ status: 1, priority: -1, createdAt: 1 }); // Sort order for queue
TokenSchema.index({ tokenNumber: 1, queueId: 1 }, { unique: true });

// ── Virtual: Time spent waiting (ms) ─────────────
TokenSchema.virtual('waitDuration').get(function () {
  if (!this.calledAt) return null;
  return (this.calledAt - this.createdAt) / 60000; // in minutes
});

module.exports = mongoose.model('Token', TokenSchema);
