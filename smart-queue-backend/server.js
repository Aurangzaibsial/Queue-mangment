/**
 * server.js
 * ─────────────────────────────────────────────
 * Smart Queue Management System — Main Server
 *
 * Architecture:
 *   Express HTTP server + Socket.io WebSocket
 *   CORS, Helmet security, Rate limiting
 *   MVC: routes → controllers → services → models
 * ─────────────────────────────────────────────
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ── Route imports ────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const queueRoutes = require('./routes/queueRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const adminRoutes = require('./routes/adminRoutes');

// ── Socket.io handler ────────────────────────────
const initSocket = require('./sockets/queueSocket');

// ─────────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io setup ──────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

// Helper function to dynamically check if the request origin is allowed
const checkOrigin = (origin, callback) => {
  // Allow requests with no origin (like mobile apps, curl, Postman, or server-to-server)
  if (!origin) {
    return callback(null, true);
  }
  
  // Dynamically allow any local origin on any port (localhost, 127.0.0.1, or [::1])
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  
  if (isLocal || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  }
};

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Reconnection settings
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize socket handlers
initSocket(io);

// ── Attach io to each request (for controller access) ──
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ─────────────────────────────────────────────────
// MIDDLEWARE STACK
// ─────────────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: checkOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    })
  );
}

// ── Global rate limiter ──────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Smart Queue API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 handler ──────────────────────────────────
app.use(notFound);

// ── Global error handler (must be last) ──────────
app.use(errorHandler);

// ─────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB first
  await connectDB();

  let currentPort = parseInt(PORT, 10);

  const tryListen = (port) => {
    server.listen(port);
  };

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${currentPort} is already in use. Retrying on port ${currentPort + 1}...`);
      currentPort++;
      tryListen(currentPort);
    } else {
      logger.error(`Server error: ${err.message}`);
      process.exit(1);
    }
  });

  server.on('listening', () => {
    logger.info(`
╔══════════════════════════════════════════╗
║   Smart Queue API — Server Started       ║
║   Port    : ${currentPort}                           ║
║   Mode    : ${process.env.NODE_ENV || 'development'}                  ║
║   WS      : Socket.io enabled            ║
╚══════════════════════════════════════════╝
    `);
  });

  tryListen(currentPort);
};

startServer().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

// ── Unhandled rejection safety net ──────────────
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = { app, server, io }; // Export for testing
