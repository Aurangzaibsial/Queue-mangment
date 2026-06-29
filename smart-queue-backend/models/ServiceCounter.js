/**
 * models/ServiceCounter.js
 * ─────────────────────────────────────────────
 * Service Counter model — represents a physical
 * or virtual service window/counter.
 * Each counter processes one token at a time.
 * ─────────────────────────────────────────────
 */

const mongoose = require('mongoose');

const ServiceCounterSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    counterName: {
      type: String,
      required: [true, 'Counter name is required'],
      trim: true,
      maxlength: [60, 'Counter name cannot exceed 60 characters'],
    },
    counterNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'break', 'busy'],
        message: 'Counter status must be active, inactive, break, or busy',
      },
      default: 'inactive',
    },
    // Token currently being served
    currentToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      default: null,
    },
    // Which queue this counter is assigned to (null = handles all)
    assignedQueue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Queue',
      default: null,
    },
    // Operator logged into this counter
    operatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // ML-updated average service time (minutes)
    averageServiceTime: {
      type: Number,
      default: 5,
      min: 0,
    },
    // Total tokens served by this counter (lifetime)
    totalServed: {
      type: Number,
      default: 0,
    },
    // Service time history for ML (ring buffer, last 50)
    serviceTimeHistory: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────
ServiceCounterSchema.index({ businessId: 1, status: 1 });
ServiceCounterSchema.index({ businessId: 1, assignedQueue: 1 });
ServiceCounterSchema.index({ businessId: 1, counterNumber: 1 }, { unique: true });

/**
 * Instance method: Update average service time using EMA
 * @param {number} newTime — actual service time in minutes
 */
ServiceCounterSchema.methods.updateAvgServiceTime = function (newTime) {
  const alpha = 0.1; // Learning rate
  this.averageServiceTime = parseFloat(
    (this.averageServiceTime + alpha * (newTime - this.averageServiceTime)).toFixed(2)
  );

  // Keep last 50 entries for analytics
  this.serviceTimeHistory.push(newTime);
  if (this.serviceTimeHistory.length > 50) {
    this.serviceTimeHistory.shift();
  }
};

module.exports = mongoose.model('ServiceCounter', ServiceCounterSchema);
