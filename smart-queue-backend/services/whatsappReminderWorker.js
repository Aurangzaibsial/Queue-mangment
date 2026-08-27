const Token = require('../models/Token');
const { sendTurnReminder } = require('./whatsappService');
const logger = require('../utils/logger');

const processReminders = async () => {
  const now = new Date();
  const upperBound = new Date(now.getTime() + 30 * 60 * 1000);
  const tokens = await Token.find({
    status: 'waiting',
    whatsappOptIn: true,
    whatsappNumber: { $exists: true, $ne: '' },
    whatsappReminderSentAt: null,
    estimatedTurnAt: { $gt: now, $lte: upperBound },
  }).populate('businessId', 'name').limit(100);

  for (const token of tokens) {
    try {
      const sent = await sendTurnReminder(token);
      if (sent) await Token.findByIdAndUpdate(token._id, { whatsappReminderSentAt: new Date() });
    } catch (error) {
      logger.error(`WhatsApp reminder failed for token ${token.tokenNumber}: ${error.message}`);
    }
  }
};

const startWhatsAppReminderWorker = () => {
  const interval = setInterval(() => {
    processReminders().catch((error) => logger.error(`WhatsApp worker failed: ${error.message}`));
  }, 60 * 1000);
  interval.unref();
  return interval;
};

module.exports = { startWhatsAppReminderWorker, processReminders };