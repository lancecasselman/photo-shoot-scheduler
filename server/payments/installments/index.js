/**
 * Installment Plans Module
 * Stripe-based payment plans with Connect transfers
 */

const installmentRoutes = require('./routes');
const { processWebhookEvent } = require('./webhooks');
const { verifyWebhookSignature } = require('./stripe');
const mathFunctions = require('./math');
const daoFunctions = require('./dao');

module.exports = {
  installmentRoutes,
  processWebhookEvent,
  verifyWebhookSignature,
  ...mathFunctions,
  ...daoFunctions
};
