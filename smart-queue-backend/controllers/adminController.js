/**
 * controllers/adminController.js
 * ─────────────────────────────────────────────
 * Admin controller.
 * Handles: call next token, counter management,
 * analytics dashboard, and queue optimization.
 * ─────────────────────────────────────────────
 */

const Token = require('../models/Token');
const Queue = require('../models/Queue');
const ServiceCounter = require('../models/ServiceCounter');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  recalculateQueueWaitTimes,
  learnFromCompletedToken,
  optimizeCounterAssignment,
  getPeakHourAnalysis,
} = require('../services/aiPredictionService');
const logger = require('../utils/logger');

// ── POST /api/admin/call-next ────────────────────
/**
 * Call the next token in a queue.
 * Marks the currently serving token as completed,
 * then pulls the next waiting token into serving state.
 *
 * Body: { queueId, counterId }
 */
exports.callNext = async (req, res, next) => {
  try {
    const { queueId, counterId } = req.body;

    const counter = await ServiceCounter.findOne({ _id: counterId, businessId: req.businessId });
    if (!counter) return sendError(res, 404, 'Counter not found or belongs to another business.');
    if (counter.status === 'inactive') return sendError(res, 400, 'Counter is inactive.');

    // ── Complete currently serving token ─────────
    if (counter.currentToken) {
      const currentToken = await Token.findById(counter.currentToken);
      if (currentToken && currentToken.status === 'serving') {
        currentToken.status = 'completed';
        currentToken.completedAt = new Date();
        await currentToken.save();

        // ML: Feed actual service time to AI engine
        await learnFromCompletedToken(currentToken);

        logger.info(`Token completed: ${currentToken.tokenNumber}`);
      }
    }

    // ── Pull next waiting token (priority order) ──
    const nextToken = await Token.findOne({
      queueId,
      status: 'waiting',
    })
      .sort({ priority: -1, createdAt: 1 }) // Emergency > VIP > Normal, then FIFO
      .populate('userId', 'name email');

    if (!nextToken) {
      // Update counter to idle
      await ServiceCounter.findByIdAndUpdate(counterId, {
        status: 'active',
        currentToken: null,
      });

      return sendSuccess(res, 200, 'No more tokens in queue.', { nextToken: null });
    }

    // Mark token as serving
    nextToken.status = 'serving';
    nextToken.calledAt = new Date();
    nextToken.assignedCounter = counterId;
    await nextToken.save();

    // Update counter
    await ServiceCounter.findByIdAndUpdate(counterId, {
      status: 'busy',
      currentToken: nextToken._id,
    });

    // Recalculate wait times for remaining queue
    const updatedQueue = await recalculateQueueWaitTimes(queueId);

    logger.info(`Token called: ${nextToken.tokenNumber} → Counter ${counter.counterName}`);

    // ── Broadcast real-time events ────────────────
    if (req.io) {
      // Notify everyone in this queue room
      req.io.to(`queue:${queueId}`).emit('tokenCalled', {
        token: nextToken,
        counter: { _id: counter._id, name: counter.counterName, number: counter.counterNumber },
      });

      // Update all wait times
      req.io.to(`queue:${queueId}`).emit('waitTimeUpdated', {
        queueId,
        tokens: updatedQueue.map((t) => ({
          id: t._id,
          position: t.position,
          estimatedWaitTime: t.estimatedWaitTime,
        })),
      });

      req.io.to(`queue:${queueId}`).emit('queueUpdated', {
        queueId,
        queueLength: updatedQueue.length,
      });

      // Personal notification to the called user
      req.io.to(`user:${nextToken.userId._id}`).emit('yourTurn', {
        token: nextToken,
        counter: { name: counter.counterName, number: counter.counterNumber },
        message: `It's your turn! Please proceed to ${counter.counterName}.`,
      });
    }

    return sendSuccess(res, 200, 'Next token called successfully', {
      servedToken: nextToken,
      counter,
      queueLength: updatedQueue.length,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/admin/update-counter ──────────────
/**
 * Update a service counter's status or settings.
 * Body: { counterId, status?, counterName?, assignedQueue? }
 */
exports.updateCounter = async (req, res, next) => {
  try {
    const { counterId, status, counterName, assignedQueue, averageServiceTime } = req.body;

    const allowed = { status, counterName, assignedQueue, averageServiceTime };
    // Strip undefined fields
    const updates = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));

    if (updates.status === 'inactive') {
      updates.currentToken = null;
    }

    const counter = await ServiceCounter.findOneAndUpdate(
      { _id: counterId, businessId: req.businessId },
      updates,
      { new: true, runValidators: true }
    ).populate('currentToken').populate('operatedBy', 'name');

    if (!counter) return sendError(res, 404, 'Counter not found or belongs to another business.');

    if (req.io) {
      req.io.emit('counterUpdated', { counter });
    }

    return sendSuccess(res, 200, 'Counter updated', counter);
  } catch (error) {
    next(error);
  }
};

// ── POST /api/admin/counters ─────────────────────
/**
 * Create a new service counter.
 */
exports.createCounter = async (req, res, next) => {
  try {
    const { counterName, counterNumber, assignedQueue } = req.body;

    const counter = await ServiceCounter.create({
      businessId: req.businessId,
      counterName,
      counterNumber,
      assignedQueue: assignedQueue || null,
      operatedBy: req.user._id,
      status: 'active',
    });

    return sendSuccess(res, 201, 'Counter created', counter);
  } catch (error) {
    next(error);
  }
};

// ── GET /api/admin/analytics ─────────────────────
/**
 * Comprehensive analytics dashboard data.
 * Returns: overview stats, category breakdown,
 * peak hours, ML model state, recent history.
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { queueId, days = 7 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filter = { businessId: req.businessId, createdAt: { $gte: since } };
    if (queueId) filter.queueId = queueId;

    // ── Overview Aggregation ──────────────────────
    const [overview, categoryBreakdown, activeCounters, allQueues, peakHours] = await Promise.all([
      Token.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: 1 },
            served: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            avgWaitTime: { $avg: '$estimatedWaitTime' },
            avgActualWait: { $avg: '$actualWaitTime' },
          },
        },
      ]),

      // Breakdown by category
      Token.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            served: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            avgWait: { $avg: '$estimatedWaitTime' },
          },
        },
        { $sort: { count: -1 } },
      ]),

      ServiceCounter.find({ businessId: req.businessId, status: 'active' })
        .populate('currentToken', 'tokenNumber customerName')
        .select('counterName counterNumber averageServiceTime totalServed status'),

      Queue.find({ businessId: req.businessId, isActive: true }).select('serviceName category analytics status'),

      // Peak hour data
      Token.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
            avgWait: { $avg: '$estimatedWaitTime' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // ── Daily trend (last N days) ─────────────────
    const dailyTrend = await Token.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          served: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // ── ML model weights from counters ────────────
    const mlWeights = {};
    for (const c of activeCounters) {
      mlWeights[c.counterName] = c.averageServiceTime;
    }

    // Fill 24-hour peak hours
    const peakHourFull = Array.from({ length: 24 }, (_, h) => {
      const found = peakHours.find((p) => p._id === h);
      return {
        hour: h,
        label: `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`,
        count: found?.count || 0,
        avgWait: found?.avgWait ? parseFloat(found.avgWait.toFixed(1)) : 0,
      };
    });

    return sendSuccess(res, 200, 'Analytics retrieved', {
      overview: overview[0] || {
        totalTokens: 0, served: 0, skipped: 0, cancelled: 0,
        avgWaitTime: 0, avgActualWait: 0,
      },
      categoryBreakdown,
      activeCounters,
      queues: allQueues,
      peakHours: peakHourFull,
      dailyTrend,
      mlWeights,
      periodDays: parseInt(days),
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/admin/optimize ─────────────────────
/**
 * Trigger auto counter-to-queue optimization.
 * Suggests optimal token-to-counter assignments.
 */
exports.optimizeQueue = async (req, res, next) => {
  try {
    const { queueId } = req.body;
    const result = await optimizeCounterAssignment(queueId);
    return sendSuccess(res, 200, 'Optimization suggestions generated', result);
  } catch (error) {
    next(error);
  }
};

// ── GET /api/admin/users ─────────────────────────
/**
 * List all users (superadmin only).
 */
exports.listUsers = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { page = 1, limit = 20, role } = req.query;
    const filter = role ? { role } : {};

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').skip((page - 1) * limit).limit(parseInt(limit)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, 'Users retrieved', users, {
      page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};
