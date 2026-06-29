/**
 * controllers/tokenController.js
 * ─────────────────────────────────────────────
 * Token booking controller.
 * Handles joining queue, checking status, and
 * retrieving token details with AI wait prediction.
 * ─────────────────────────────────────────────
 */

const Token = require('../models/Token');
const Queue = require('../models/Queue');
const ServiceCounter = require('../models/ServiceCounter');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { predictWaitTime, recalculateQueueWaitTimes } = require('../services/aiPredictionService');
const logger = require('../utils/logger');

/**
 * Generate a human-readable token number.
 * Format: {CategoryLetter}-{PaddedNumber}  e.g., "B-042"
 */
const generateTokenNumber = async (queueId, category) => {
  const prefix = (category || 'G')[0].toUpperCase();
  const count = await Token.countDocuments({ queueId });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
};

// ── POST /api/token/book ─────────────────────────
/**
 * Book a token (join a queue).
 * Body: { queueId, priority?, notes? }
 * Auth: Required (any user)
 */
exports.bookToken = async (req, res, next) => {
  try {
    const { queueId, priority = 'normal', notes, customerName } = req.body;

    // Validate queue exists and is active
    const queue = await Queue.findOne({ _id: queueId, isActive: true, status: 'active' });
    if (!queue) {
      return sendError(res, 404, 'Queue not found or is currently closed.');
    }

    // Check capacity
    const currentCount = await Token.countDocuments({ queueId, status: 'waiting' });
    if (currentCount >= queue.maxCapacity) {
      return sendError(res, 409, `Queue is at full capacity (${queue.maxCapacity}). Please try later.`);
    }

    // Prevent duplicate active tokens for same user in same queue
    const existing = await Token.findOne({
      userId: req.user._id,
      queueId,
      status: { $in: ['waiting', 'serving'] },
    });
    if (existing) {
      return sendError(res, 409, `You already have an active token (${existing.tokenNumber}) in this queue.`);
    }

    // Determine position (VIP/emergency jump ahead of normals)
    let position;
    if (priority === 'emergency') {
      position = 1;
      // Shift everyone else back
      await Token.updateMany({ queueId, status: 'waiting' }, { $inc: { position: 1 } });
    } else if (priority === 'vip') {
      const vipCount = await Token.countDocuments({ queueId, status: 'waiting', priority: 'vip' });
      const emergencyCount = await Token.countDocuments({ queueId, status: 'waiting', priority: 'emergency' });
      position = emergencyCount + vipCount + 1;
      await Token.updateMany(
        { queueId, status: 'waiting', priority: 'normal', position: { $gte: position } },
        { $inc: { position: 1 } }
      );
    } else {
      position = currentCount + 1;
    }

    // Generate token number
    const tokenNumber = await generateTokenNumber(queueId, queue.category);

    // Get AI-predicted wait time
    const activeCounters = await ServiceCounter.countDocuments({ status: 'active' });
    const estimatedWaitTime = await predictWaitTime({
      queueId,
      tokenId: null,
      category: queue.category,
      priority,
      activeCounters: Math.max(activeCounters, 1),
    });

    // Create token
    const token = await Token.create({
      businessId: queue.businessId,
      tokenNumber,
      userId: req.user._id,
      queueId,
      position,
      priority,
      estimatedWaitTime,
      category: queue.category,
      customerName: customerName || req.user.name,
      notes,
    });

    await token.populate('userId', 'name email');
    await token.populate('queueId', 'serviceName category');

    // Increment queue counter
    await Queue.findByIdAndUpdate(queueId, { $inc: { queueNumber: 1 } });

    logger.info(`Token booked: ${tokenNumber} for ${req.user.email} in queue ${queue.serviceName}`);

    // Broadcast new token to all queue subscribers
    if (req.io) {
      req.io.to(`queue:${queueId}`).emit('newTokenAdded', {
        token,
        queueLength: currentCount + 1,
      });
      req.io.emit('waitTimeUpdated', { queueId, tokenId: token._id, estimatedWaitTime });
    }

    return sendSuccess(res, 201, 'Token booked successfully', {
      token,
      message: `Your turn is in approximately ${Math.round(estimatedWaitTime)} minutes`,
      position,
      estimatedWaitTime,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/token/:id ───────────────────────────
/**
 * Get a single token with live AI prediction refresh.
 */
exports.getToken = async (req, res, next) => {
  try {
    const token = await Token.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('queueId', 'serviceName category status')
      .populate('assignedCounter', 'counterName counterNumber');

    if (!token) return sendError(res, 404, 'Token not found.');

    // Authorization: user can only see their own tokens (admins see all)
    if (req.user.role === 'user' && token.userId._id.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized to view this token.');
    }

    // Refresh prediction if still waiting
    let refreshedWait = token.estimatedWaitTime;
    if (token.status === 'waiting') {
      const activeCounters = await ServiceCounter.countDocuments({ status: 'active' });
      refreshedWait = await predictWaitTime({
        queueId: token.queueId._id,
        tokenId: token._id,
        category: token.category,
        priority: token.priority,
        activeCounters: Math.max(activeCounters, 1),
      });

      // Persist updated prediction
      await Token.findByIdAndUpdate(token._id, { estimatedWaitTime: refreshedWait });
    }

    // Count people ahead
    const peopleAhead = token.status === 'waiting'
      ? await Token.countDocuments({ queueId: token.queueId._id, status: 'waiting', position: { $lt: token.position } })
      : 0;

    const dynamicMessage = token.status === 'serving'
      ? "It's your turn! Please proceed to the counter."
      : peopleAhead === 0
      ? "You're next! Get ready."
      : peopleAhead <= 2
      ? `You are ${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} away from your turn`
      : `Your turn is in approximately ${Math.round(refreshedWait)} minutes`;

    return sendSuccess(res, 200, 'Token retrieved', {
      token: { ...token.toObject(), estimatedWaitTime: refreshedWait },
      peopleAhead,
      dynamicMessage,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/token/user/:userId ──────────────────
/**
 * Get all tokens for a specific user.
 * Users can only query their own; admins can query any.
 */
exports.getUserTokens = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Authorization check
    if (req.user.role === 'user' && req.user._id.toString() !== userId) {
      return sendError(res, 403, 'Not authorized to view other users\' tokens.');
    }

    const filter = { userId };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      Token.find(filter)
        .populate('queueId', 'serviceName category')
        .populate('assignedCounter', 'counterName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Token.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, 'Tokens retrieved', tokens, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/token/:id/cancel ─────────────────
/**
 * Cancel a waiting token (user withdraws from queue).
 */
exports.cancelToken = async (req, res, next) => {
  try {
    const token = await Token.findById(req.params.id);

    if (!token) return sendError(res, 404, 'Token not found.');

    if (req.user.role === 'user' && token.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized.');
    }

    if (!['waiting'].includes(token.status)) {
      return sendError(res, 400, `Cannot cancel a token with status: ${token.status}`);
    }

    token.status = 'cancelled';
    await token.save();

    // Re-sort positions for tokens behind this one
    await Token.updateMany(
      { queueId: token.queueId, status: 'waiting', position: { $gt: token.position } },
      { $inc: { position: -1 } }
    );

    // Recalculate wait times for remaining queue
    await recalculateQueueWaitTimes(token.queueId);

    if (req.io) {
      req.io.to(`queue:${token.queueId}`).emit('queueUpdated', { queueId: token.queueId });
    }

    return sendSuccess(res, 200, 'Token cancelled successfully');
  } catch (error) {
    next(error);
  }
};
