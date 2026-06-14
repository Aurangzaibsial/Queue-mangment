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
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Use the new URL parser and unified topology
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    retryCount = 0; // Reset on success
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    retryCount++;
    logger.error(`❌ MongoDB connection error (attempt ${retryCount}): ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      logger.info(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      setTimeout(connectDB, RETRY_DELAY_MS);
    } else {
      logger.error('💥 Max retries reached. Exiting process.');
      process.exit(1);
    }
  }
};

// ── Connection event listeners ──────────────────
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
  connectDB();
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
