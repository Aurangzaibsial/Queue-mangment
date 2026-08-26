const Queue = require('../models/Queue');
const Business = require('../models/Business');
const Token = require('../models/Token');
const ServiceCounter = require('../models/ServiceCounter');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { recalculateQueueWaitTimes } = require('../services/aiPredictionService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

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

    let [queues, total] = await Promise.all([
      Queue.find(filter)
        .populate('managedBy', 'name email')
        .populate('currentLength')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Queue.countDocuments(filter),
    ]);

    // If this business has no queues at all, auto-provision default queues for its category
    if (total === 0 && !status && !category) {
      const biz = await Business.findById(req.businessId);
      if (biz) {
        const defaultQueues = getDefaultQueuesForCategory(biz.category, biz.pricing?.baseRate || 0);
        for (const dq of defaultQueues) {
          await Queue.create({
            businessId: biz._id,
            serviceName: dq.serviceName,
            category: dq.category,
            estimatedServiceTime: dq.estimatedServiceTime,
            serviceFee: dq.serviceFee,
            description: dq.description,
            managedBy: biz.ownerId,
            status: 'active',
            isActive: true,
          });
        }

        queues = await Queue.find(filter)
          .populate('managedBy', 'name email')
          .populate('currentLength')
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ createdAt: -1 });
        total = await Queue.countDocuments(filter);
      }
    }

    // Enrich each queue with live token count and active counters
    const enriched = await Promise.all(
      queues.map(async (q) => {
        const [waitingCount, activeCounters] = await Promise.all([
          Token.countDocuments({ queueId: q._id, status: 'waiting' }),
          ServiceCounter.countDocuments({ status: 'active', assignedQueue: q._id }),
        ]);

        // Get AI-powered wait time prediction for this queue
        let aiWaitTime = null;
        let aiSource = 'local';
        try {
          const aiPrediction = await aiService.predictWaitTime(
            q._id.toString(),
            null,
            q.category,
            'normal',
            Math.max(activeCounters, 1)
          );
          aiWaitTime = aiPrediction.estimated_wait_minutes;
          aiSource = 'ai';
        } catch (error) {
          // Use local estimate if AI fails
          const perPersonTime = q.estimatedServiceTime || q.estimatedWaitTimePerPerson || 5;
          aiWaitTime = perPersonTime * Math.max(waitingCount, 1);
          aiSource = 'local';
        }

        return {
          ...q.toObject(),
          waitingCount,
          activeCounters,
          estimatedWaitTime: aiWaitTime,
          aiPowered: aiSource === 'ai',
          aiSource,
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
    const queueFilter = { _id: req.params.id };
    if (req.user && ['admin', 'owner'].includes(req.user.role)) {
      queueFilter.businessId = req.user.businessId;
    }

    const queue = await Queue.findOne(queueFilter)
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
