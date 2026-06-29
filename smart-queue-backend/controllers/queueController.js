/**
 * controllers/queueController.js
 * ─────────────────────────────────────────────
 * Queue management controller.
 * CRUD operations for service queues.
 * ─────────────────────────────────────────────
 */

const Queue = require('../models/Queue');
const Token = require('../models/Token');
const ServiceCounter = require('../models/ServiceCounter');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { recalculateQueueWaitTimes } = require('../services/aiPredictionService');
const logger = require('../utils/logger');

// ── POST /api/queue/create ───────────────────────
/**
 * Create a new service queue.
 * Admin only.
 */
exports.createQueue = async (req, res, next) => {
  try {
    const { serviceName, category, estimatedWaitTimePerPerson, description } = req.body;

    const queue = await Queue.create({
      businessId: req.businessId,
      serviceName,
      category,
      estimatedWaitTimePerPerson: estimatedWaitTimePerPerson || 5, // Default 5 mins
      description,
      managedBy: req.user.id,
    });

    logger.info(`Queue created: ${serviceName} by ${req.user.email}`);

    // Emit socket event (attached to req by socket middleware)
    if (req.io) {
      req.io.to(`business:${req.businessId}`).emit('queueCreated', { queue });
    }

    return sendSuccess(res, 201, 'Queue created successfully', queue);
  } catch (error) {
    next(error);
  }
};

// ── GET /api/queue/list ──────────────────────────
/**
 * List all active queues with current token counts.
 * Supports pagination and filtering.
 */
exports.listQueues = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { businessId: req.businessId, isActive: true };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [queues, total] = await Promise.all([
      Queue.find(filter)
        .populate('managedBy', 'name email')
        .populate('currentLength') // Virtual populated token count
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Queue.countDocuments(filter),
    ]);

    // Enrich each queue with live token count and active counters
    const enriched = await Promise.all(
      queues.map(async (q) => {
        const [waitingCount, activeCounters] = await Promise.all([
          Token.countDocuments({ queueId: q._id, status: 'waiting' }),
          ServiceCounter.countDocuments({ status: 'active', assignedQueue: q._id }),
        ]);
        return {
          ...q.toObject(),
          waitingCount,
          activeCounters,
        };
      })
    );

    return sendPaginated(res, enriched, page, limit, total);
  } catch (error) {
    next(error);
  }
};

// ── GET /api/queue/:id ───────────────────────────
/**
 * Get a single queue with full details and waiting tokens.
 */
exports.getQueue = async (req, res, next) => {
  try {
    const queue = await Queue.findById(req.params.id)
      .populate('managedBy', 'name email');

    if (!queue) {
      return sendError(res, 404, 'Queue not found.');
    }

    // Get current waiting tokens (sorted by priority + join time)
    const waitingTokens = await Token.find({ queueId: queue._id, status: 'waiting' })
      .populate('userId', 'name email')
      .sort({ priority: -1, createdAt: 1 })
      .limit(50);

    const servingToken = await Token.findOne({ queueId: queue._id, status: 'serving' })
      .populate('userId', 'name email');

    const activeCounters = await ServiceCounter.find({
      $or: [{ assignedQueue: queue._id }, { assignedQueue: null }],
      status: 'active',
    });

    return sendSuccess(res, 200, 'Queue retrieved', {
      queue,
      waitingTokens,
      servingToken,
      activeCounters,
      stats: {
        waitingCount: waitingTokens.length,
        activeCounterCount: activeCounters.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/queue/:id ───────────────────────────
/**
 * Update queue settings (admin only).
 */
exports.updateQueue = async (req, res, next) => {
  try {
    const allowed = ['serviceName', 'description', 'status', 'maxCapacity', 'estimatedServiceTime', 'priorityLevel'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const queue = await Queue.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!queue) return sendError(res, 404, 'Queue not found.');

    if (req.io) req.io.emit('queueUpdated', { queueId: queue._id, updates });

    return sendSuccess(res, 200, 'Queue updated', queue);
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/queue/:id ────────────────────────
/**
 * Soft-delete a queue (sets isActive = false).
 */
exports.deleteQueue = async (req, res, next) => {
  try {
    const queue = await Queue.findByIdAndUpdate(
      req.params.id,
      { isActive: false, status: 'closed' },
      { new: true }
    );

    if (!queue) return sendError(res, 404, 'Queue not found.');

    logger.info(`Queue soft-deleted: ${queue.serviceName}`);
    return sendSuccess(res, 200, 'Queue closed successfully');
  } catch (error) {
    next(error);
  }
};
