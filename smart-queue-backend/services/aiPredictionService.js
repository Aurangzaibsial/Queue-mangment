/**
 * services/aiPredictionService.js
 * ─────────────────────────────────────────────
 * AI Waiting Time Prediction Service.
 *
 * Core Formula:
 *   predicted_wait = (peopleAhead × avgServiceTime × peakFactor) / activeCounters
 *
 * ML Enhancement:
 *   - Learns from historical queue data using EMA
 *   - Applies time-of-day peak hour weighting
 *   - Category-specific service time calibration
 * ─────────────────────────────────────────────
 */

const Token = require('../models/Token');
const ServiceCounter = require('../models/ServiceCounter');
const Queue = require('../models/Queue');
const logger = require('../utils/logger');

// ── Default service times per category (minutes) ──
// These are initial seeds; updated via ML learning
const DEFAULT_SERVICE_TIMES = {
  General: 4,
  Support: 6,
  Billing: 5,
  Technical: 8,
  Emergency: 3,
  VIP: 5,
};

// Peak hour multipliers (hour 0-23)
// Peak: 11am–2pm (1.3×), Morning rush: 9–10am (1.1×)
const getPeakFactor = (hour) => {
  if (hour >= 11 && hour <= 14) return 1.3;
  if (hour >= 9 && hour <= 10) return 1.1;
  if (hour >= 15 && hour <= 17) return 1.15;
  return 1.0;
};

// Priority wait reduction factor (VIP/emergency served faster)
const PRIORITY_FACTORS = {
  normal: 1.0,
  vip: 0.4,    // VIPs get ~60% faster estimated position
  emergency: 0.1,
};

/**
 * Calculate predicted wait time for a specific token.
 *
 * @param {object} params
 * @param {string} params.queueId       - Queue ID
 * @param {string} params.tokenId       - Token ID to predict for
 * @param {string} params.category      - Service category
 * @param {string} params.priority      - Token priority
 * @param {number} params.activeCounters - Number of active counters
 * @returns {Promise<number>} Estimated wait time in minutes
 */
const predictWaitTime = async ({ queueId, tokenId, category, priority, activeCounters }) => {
  try {
    const queue = await Queue.findById(queueId).select('businessId');
    const businessId = queue ? queue.businessId : null;
    // Count how many tokens are ahead (waiting + serving takes 1 slot)
    const peopleAhead = await Token.countDocuments({
      queueId,
      status: { $in: ['waiting', 'serving'] },
      $or: [
        { priority: 'emergency', createdAt: { $lt: new Date() } },
        { priority: 'vip', _id: { $ne: tokenId } },
        { priority: 'normal', _id: { $ne: tokenId } },
      ],
    });

    // Get average service time from counters or use category default
    let avgServiceTime = DEFAULT_SERVICE_TIMES[category] || 5;

    // Fetch actual learned service time from active counters
    const activeCounterDocs = await ServiceCounter.find({ businessId, status: 'active' }).limit(10);
    if (activeCounterDocs.length > 0) {
      const totalAvg = activeCounterDocs.reduce((sum, c) => sum + c.averageServiceTime, 0);
      avgServiceTime = totalAvg / activeCounterDocs.length;
    }

    // Apply peak hour factor
    const currentHour = new Date().getHours();
    const peakFactor = getPeakFactor(currentHour);

    // Apply priority factor (VIP/emergency customers have fewer effective people ahead)
    const priorityFactor = PRIORITY_FACTORS[priority] || 1.0;

    // Count actual active counters if not provided
    let counters = activeCounters;
    if (!counters) {
      counters = await ServiceCounter.countDocuments({ businessId, status: 'active' });
      counters = Math.max(counters, 1); // Minimum 1
    }

    // ── Core AI Prediction Formula ─────────────────
    const predictedWait = (peopleAhead * avgServiceTime * peakFactor * priorityFactor) / Math.max(counters, 1);

    return Math.max(0.5, parseFloat(predictedWait.toFixed(1)));
  } catch (error) {
    logger.error(`AI Prediction error: ${error.message}`);
    // Fallback to simple formula
    return Math.max(1, (DEFAULT_SERVICE_TIMES[category] || 5));
  }
};

/**
 * Recalculate and update wait times for ALL waiting tokens in a queue.
 * Called whenever queue state changes (new token, token served, etc.)
 *
 * @param {string} queueId - Queue to recalculate
 * @returns {Promise<Array>} Updated tokens with new wait times
 */
const recalculateQueueWaitTimes = async (queueId) => {
  try {
    const queue = await Queue.findById(queueId).select('businessId');
    const businessId = queue ? queue.businessId : null;

    // Fetch all waiting tokens sorted by priority then join time
    const waitingTokens = await Token.find({ queueId, status: 'waiting' })
      .sort({ priority: -1, createdAt: 1 }); // VIP first, then FIFO

    const activeCounters = await ServiceCounter.countDocuments({ businessId, status: 'active' });
    const counters = Math.max(activeCounters, 1);

    const currentHour = new Date().getHours();
    const peakFactor = getPeakFactor(currentHour);

    // Get avg service time from counters
    const counterDocs = await ServiceCounter.find({ businessId, status: 'active' }).limit(10);
    let baseAvgTime = 5;
    if (counterDocs.length > 0) {
      baseAvgTime = counterDocs.reduce((s, c) => s + c.averageServiceTime, 0) / counterDocs.length;
    }

    const updates = [];
    for (let i = 0; i < waitingTokens.length; i++) {
      const token = waitingTokens[i];
      const priorityFactor = PRIORITY_FACTORS[token.priority] || 1.0;
      const categoryTime = DEFAULT_SERVICE_TIMES[token.category] || baseAvgTime;
      const avgTime = (categoryTime + baseAvgTime) / 2; // Blend category + counter average

      const wait = Math.max(
        0.5,
        parseFloat(((i * avgTime * peakFactor * priorityFactor) / counters).toFixed(1))
      );

      // Bulk update via model
      updates.push(
        Token.findByIdAndUpdate(token._id, { estimatedWaitTime: wait, position: i + 1 })
      );
    }

    await Promise.all(updates);

    // Return refreshed tokens for broadcasting
    return Token.find({ queueId, status: 'waiting' })
      .sort({ position: 1 })
      .populate('userId', 'name email');
  } catch (error) {
    logger.error(`Recalculate wait times error: ${error.message}`);
    throw error;
  }
};

/**
 * ML Learning: Update service time model from completed token.
 * Uses exponential moving average to adapt over time.
 *
 * @param {object} token - Completed token document
 */
const learnFromCompletedToken = async (token) => {
  try {
    if (!token.calledAt || !token.completedAt) return;

    const actualMinutes = (token.completedAt - token.calledAt) / 60000;

    // Update assigned counter's average service time
    if (token.assignedCounter) {
      const counter = await ServiceCounter.findById(token.assignedCounter);
      if (counter) {
        counter.updateAvgServiceTime(actualMinutes);
        counter.totalServed += 1;
        await counter.save();
        logger.debug(`ML Update: Counter ${counter.counterName} avg → ${counter.averageServiceTime}min`);
      }
    }

    // Update queue analytics
    await Queue.findByIdAndUpdate(token.queueId, {
      $inc: { 'analytics.totalServed': 1 },
      $set: { 'analytics.peakHour': new Date().getHours() },
    });

  } catch (error) {
    logger.error(`ML learning error: ${error.message}`);
  }
};

/**
 * Auto-optimize token assignment across multiple counters.
 * Distributes load based on counter availability and queue depth.
 *
 * @param {string} queueId - Queue to optimize
 * @returns {Promise<object>} Optimization result
 */
const optimizeCounterAssignment = async (queueId) => {
  try {
    const queue = await Queue.findById(queueId).select('businessId');
    const businessId = queue ? queue.businessId : null;

    const activeCounters = await ServiceCounter.find({
      businessId,
      status: 'active',
      currentToken: null,
    }).sort({ totalServed: 1 }); // Prefer less-busy counters

    const waitingTokens = await Token.find({ queueId, status: 'waiting' })
      .sort({ priority: -1, createdAt: 1 })
      .limit(activeCounters.length);

    const assignments = [];
    for (let i = 0; i < Math.min(activeCounters.length, waitingTokens.length); i++) {
      assignments.push({
        counter: activeCounters[i]._id,
        token: waitingTokens[i]._id,
      });
    }

    return { suggested: assignments, available: activeCounters.length };
  } catch (error) {
    logger.error(`Counter optimization error: ${error.message}`);
    return { suggested: [], available: 0 };
  }
};

/**
 * Get peak hour analysis from historical token data
 * @param {string} queueId
 * @returns {Promise<Array>} Hourly distribution
 */
const getPeakHourAnalysis = async (queueId) => {
  try {
    const result = await Token.aggregate([
      { $match: { queueId: require('mongoose').Types.ObjectId(queueId) } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
          avgWait: { $avg: '$estimatedWaitTime' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill all 24 hours
    const hourlyData = Array.from({ length: 24 }, (_, h) => {
      const found = result.find((r) => r._id === h);
      return {
        hour: h,
        label: `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`,
        count: found?.count || 0,
        avgWait: found?.avgWait ? parseFloat(found.avgWait.toFixed(1)) : 0,
        isPeak: getPeakFactor(h) > 1,
      };
    });

    return hourlyData;
  } catch (error) {
    logger.error(`Peak hour analysis error: ${error.message}`);
    return [];
  }
};

module.exports = {
  predictWaitTime,
  recalculateQueueWaitTimes,
  learnFromCompletedToken,
  optimizeCounterAssignment,
  getPeakHourAnalysis,
  DEFAULT_SERVICE_TIMES,
  getPeakFactor,
};
