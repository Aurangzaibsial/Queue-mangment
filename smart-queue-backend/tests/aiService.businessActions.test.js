const test = require('node:test');
const assert = require('node:assert/strict');

const aiService = require('../services/aiService');

test('generateBusinessActions returns queue operations and business recommendations', () => {
  const result = aiService.generateBusinessActions({
    businessName: 'Demo Clinic',
    queues: [
      { serviceName: 'General', status: 'active', currentLength: 18, estimatedServiceTime: 9, category: 'General' },
      { serviceName: 'VIP', status: 'active', currentLength: 6, estimatedServiceTime: 5, category: 'VIP' },
    ],
    counters: [
      { status: 'active', counterName: 'A' },
      { status: 'active', counterName: 'B' },
    ],
    analytics: {
      peakHours: [
        { label: '09:00', count: 12 },
        { label: '12:00', count: 18 },
        { label: '15:00', count: 10 },
      ],
    },
  });

  assert.ok(Array.isArray(result.actions));
  assert.ok(result.actions.length >= 4);
  assert.ok(result.actions.some(action => action.category === 'alerting'));
  assert.ok(result.actions.some(action => action.category === 'staffing'));
  assert.ok(result.actions.some(action => action.category === 'queue-balance'));
  assert.ok(result.actions.some(action => action.category === 'visit-timing'));
});
