const axios = require('axios');
const logger = require('../utils/logger');

const sendWhatsApp = async (to, body) => {
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken, TWILIO_WHATSAPP_FROM: from } = process.env;
  if (!accountSid || !authToken || !from) {
    logger.info(`WhatsApp notification skipped for ${to}: Twilio is not configured`);
    return false;
  }

  const params = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: body });
  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    params.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    }
  );
  return true;
};

const sendBookingConfirmation = async (token) => sendWhatsApp(
  token.whatsappNumber,
  `Booking confirmed for ${token.customerName || 'you'} at ${token.businessId?.name || 'the business'}. ` +
    `Service: ${token.queueId?.serviceName || 'your selected service'}. Token: ${token.tokenNumber}. ` +
    `Estimated arrival time: ${token.estimatedTurnAt ? new Date(token.estimatedTurnAt).toLocaleString() : 'will be updated in the queue'}.`
);

const sendTurnReminder = async (token) => sendWhatsApp(
  token.whatsappNumber,
  `Reminder: your ${token.tokenNumber} ticket at ${token.businessId?.name || 'the business'} ` +
    'is expected in about 30 minutes. Please start making your way there.'
);

module.exports = { sendBookingConfirmation, sendTurnReminder };