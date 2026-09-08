const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

process.env.PYTHON_AI_SERVICE_URL = 'http://localhost:8000';
const aiServicePath = require.resolve('../services/aiService');
delete require.cache[aiServicePath];
const aiService = require('../services/aiService');

const originalPost = axios.post;

test('predictWaitTime uses the Python AI service when configured', async () => {
  axios.post = async (url, payload, config) => {
    assert.equal(url, 'http://localhost:8000/ai/predict-wait-time');
    assert.deepEqual(payload, {
      queueId: 'queue-123',
      tokenId: 'token-456',
      category: 'General',
      priority: 'normal',
      activeCounters: 3,
      peopleAhead: 4,
    });
    return {
      data: {
        estimated_wait_minutes: 7.5,
        confidence_score: 0.82,
        source: 'ml-model',
      },
    };
  };

  try {
    const result = await aiService.predictWaitTime('queue-123', 'token-456', 'General', 'normal', 3, 4);
    assert.equal(result.estimated_wait_minutes, 7.5);
    assert.equal(result.source, 'ml-model');
    assert.equal(result.confidence_score, 0.82);
  } finally {
    axios.post = originalPost;
  }
});
