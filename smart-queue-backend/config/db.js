/**
 * config/db.js
 * ─────────────────────────────────────────────
 * MongoDB connection manager using Mongoose.
 * Implements retry logic and graceful shutdown.
 * ─────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Maximum number of connection retry attempts
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

let retryCount = 0;

/**
 * Establishes a connection to MongoDB.
 * Retries up to MAX_RETRIES times on failure.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MongoDB connection string is missing. Set MONGO_URI or MONGODB_URI.');
  }

  while (retryCount < MAX_RETRIES) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      retryCount = 0;
      logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      retryCount++;
      logger.error(`❌ MongoDB connection error (attempt ${retryCount}): ${error.message}`);

      if (retryCount >= MAX_RETRIES) {
        throw new Error('Unable to connect to MongoDB after multiple attempts.', { cause: error });
      }

      logger.info(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

// ── Connection event listeners ──────────────────
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  MongoDB disconnected. Mongoose will attempt to reconnect.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB error: ${err.message}`);
});

// ── Graceful shutdown ────────────────────────────
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed via app termination.');
  process.exit(0);
});

module.exports = connectDB;
