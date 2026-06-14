/**
 * sockets/queueSocket.js
 * ─────────────────────────────────────────────
 * Socket.io real-time event management.
 *
 * Architecture:
 *   - Each queue gets its own room: "queue:{queueId}"
 *   - Each user gets a personal room: "user:{userId}"
 *   - Admins join: "admin"
 *
 * Events emitted to clients:
 *   queueUpdated    — Queue state changed
 *   tokenCalled     — A token was called to counter
 *   newTokenAdded   — A new customer joined
 *   waitTimeUpdated — AI predictions recalculated
 *   yourTurn        — Personal notification to called user
 *   counterUpdated  — Counter status changed
 *
 * Events received from clients:
 *   joinQueue       — Subscribe to a queue's room
 *   leaveQueue      — Unsubscribe from queue room
 *   pingStatus      — Client heartbeat / request status refresh
 * ─────────────────────────────────────────────
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/Token');
const ServiceCounter = require('../models/ServiceCounter');
const { recalculateQueueWaitTimes } = require('../services/aiPredictionService');
const logger = require('../utils/logger');

/**
 * Initialize Socket.io handlers.
 * @param {import('socket.io').Server} io
 */
const initSocket = (io) => {
  // ── Authentication middleware for sockets ────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        // Allow unauthenticated connections (for public queue boards)
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) {
        socket.user = null;
        return next();
      }

      socket.user = user;
      next();
    } catch (err) {
      // Don't block connection on bad token — just mark as unauthenticated
      socket.user = null;
      next();
    }
  });

  // ── Connection handler ───────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user?._id;
    const userRole = socket.user?.role;

    logger.debug(`Socket connected: ${socket.id} ${userId ? `(user: ${userId})` : '(anonymous)'}`);

    // Join personal room if authenticated
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Admins join admin room
    if (userRole === 'admin' || userRole === 'superadmin') {
      socket.join('admin');
    }

    // ── joinQueue — Subscribe to a specific queue ──
    socket.on('joinQueue', async ({ queueId }) => {
      if (!queueId) return;

      socket.join(`queue:${queueId}`);
      logger.debug(`Socket ${socket.id} joined queue room: ${queueId}`);

      // Send current queue state on join
      try {
        const waitingTokens = await Token.find({ queueId, status: 'waiting' })
          .populate('userId', 'name')
          .sort({ position: 1 })
          .limit(20);

        const activeCounters = await ServiceCounter.find({ status: 'active' })
          .populate('currentToken', 'tokenNumber customerName');

        socket.emit('queueSnapshot', {
          queueId,
          waitingTokens,
          activeCounters,
          timestamp: new Date(),
        });
      } catch (err) {
        logger.error(`Error sending queue snapshot: ${err.message}`);
      }
    });

    // ── leaveQueue ────────────────────────────────
    socket.on('leaveQueue', ({ queueId }) => {
      if (queueId) {
        socket.leave(`queue:${queueId}`);
        logger.debug(`Socket ${socket.id} left queue room: ${queueId}`);
      }
    });

    // ── pingStatus — Client requests a status refresh ──
    socket.on('pingStatus', async ({ queueId, tokenId }) => {
      try {
        if (tokenId) {
          const token = await Token.findById(tokenId);
          if (token) {
            socket.emit('tokenStatus', {
              tokenId,
              status: token.status,
              position: token.position,
              estimatedWaitTime: token.estimatedWaitTime,
            });
          }
        }

        if (queueId) {
          const count = await Token.countDocuments({ queueId, status: 'waiting' });
          const counters = await ServiceCounter.countDocuments({ status: 'active' });
          socket.emit('queueStats', { queueId, waitingCount: count, activeCounters: counters });
        }
      } catch (err) {
        logger.error(`pingStatus error: ${err.message}`);
      }
    });

    // ── adminAction — Admin triggers manual queue action ──
    socket.on('adminAction', async ({ action, queueId }) => {
      if (!userId || (userRole !== 'admin' && userRole !== 'superadmin')) {
        return socket.emit('error', { message: 'Admin access required' });
      }

      if (action === 'refreshWaitTimes' && queueId) {
        try {
          const updated = await recalculateQueueWaitTimes(queueId);
          io.to(`queue:${queueId}`).emit('waitTimeUpdated', {
            queueId,
            tokens: updated.map((t) => ({
              id: t._id,
              position: t.position,
              estimatedWaitTime: t.estimatedWaitTime,
            })),
          });
          socket.emit('actionComplete', { action, success: true });
        } catch (err) {
          socket.emit('error', { message: 'Failed to refresh wait times' });
        }
      }
    });

    // ── Disconnect ─────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
    });

    // ── Error handler ─────────────────────────────
    socket.on('error', (err) => {
      logger.error(`Socket error: ${err.message}`);
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
};

module.exports = initSocket;
