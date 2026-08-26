/**
 * services/aiService.js
 * ─────────────────────────────────────────────
 * AI API Integration Layer for Naubex
 * Powered by Google Gemini API & OpenAI API
 * with intelligent multi-factor scoring fallback
 * ─────────────────────────────────────────────
 */

const axios = require('axios');
const logger = require('../utils/logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-3.6-flash';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || '';

/**
 * Check if Gemini key is set
 */
const isValidGeminiKey = (key) => key && key.trim().length > 10;

/**
 * Extract full text from Gemini response.
 * Handles multi-part responses from thinking models (gemini-3.6-flash, etc.)
 */
const extractGeminiText = (responseData) => {
  const parts = responseData?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter(p => typeof p.text === 'string')
    .map(p => p.text)
    .join('');
};

// Ordered list of fallback models to try if the primary is unavailable
const GEMINI_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
];

class AIService {
  /**
   * Check if an external AI API is configured
   */
  isConfigured() {
    return Boolean(
      isValidGeminiKey(GEMINI_API_KEY) ||
      (OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0) ||
      (PYTHON_AI_SERVICE_URL && PYTHON_AI_SERVICE_URL.trim().length > 0)
    );
  }

  /**
   * Health check for AI service
   */
  async healthCheck() {
    const geminiAvailable = isValidGeminiKey(GEMINI_API_KEY);
    const openAiAvailable = Boolean(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0);
    const pythonAvailable = Boolean(PYTHON_AI_SERVICE_URL && PYTHON_AI_SERVICE_URL.trim().length > 0);

    return {
      status: (geminiAvailable || openAiAvailable || pythonAvailable) ? 'healthy' : 'fallback-mode',
      provider: geminiAvailable ? 'Google Gemini' : openAiAvailable ? 'OpenAI' : pythonAvailable ? 'Python AI Microservice' : 'Multi-Factor Scoring',
      model: geminiAvailable ? GEMINI_MODEL : openAiAvailable ? OPENAI_MODEL : pythonAvailable ? 'fastapi-vector-scoring' : 'internal-heuristic',
      apiKeyConfigured: geminiAvailable || openAiAvailable || pythonAvailable,
      features: {
        geminiRecommendations: geminiAvailable,
        openAiRecommendations: openAiAvailable,
        pythonMicroserviceRecommendations: pythonAvailable,
        smartRankingFallback: true,
        ratingAndRateScoring: true,
      }
    };
  }

  // ──────────────────────────────────────────────────────────
  // BUSINESS & QUEUE RECOMMENDATION ENGINE (Rating & Rate Based)
  // ──────────────────────────────────────────────────────────

  /**
   * Recommend businesses based on ratings, rates, wait times and an optional
   * natural-language prompt processed by Gemini API, OpenAI, or Python AI service.
   */
  async recommendBusinesses(preferences) {
    const {
      businesses = [],
      sortBy = 'ai',
      category,
      maxBudget,
      minRating,
      prompt
    } = preferences;

    if (!businesses.length) {
      return { recommendations: [], source: 'empty', reasoning: 'No businesses available.' };
    }

    // ── 0. Try Python AI Microservice if configured ───────────
    if (PYTHON_AI_SERVICE_URL && PYTHON_AI_SERVICE_URL.trim().length > 0) {
      try {
        const pythonResult = await this._queryPythonAIService(businesses, preferences);
        if (pythonResult && pythonResult.recommendations) {
          return pythonResult;
        }
      } catch (err) {
        logger.warn('Python AI service call failed, attempting Gemini/fallback', { error: err.message });
      }
    }

    // ── 1. Try Gemini API ─────────────────────────────────────
    if (isValidGeminiKey(GEMINI_API_KEY)) {
      try {
        const geminiResult = await this._queryGemini(businesses, preferences);
        if (geminiResult && geminiResult.recommendations !== undefined) {
          return geminiResult;
        }
      } catch (err) {
        logger.warn('Gemini API call failed, falling back to scoring algorithm', { error: err.message });
      }
    }

    // ── 2. Try OpenAI API if configured ──────────────────────
    if (OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0) {
      try {
        const openAiResult = await this._queryOpenAI(businesses, preferences);
        if (openAiResult && openAiResult.recommendations !== undefined) {
          return openAiResult;
        }
      } catch (err) {
        logger.warn('OpenAI API call failed, falling back to multi-factor scoring', { error: err.message });
      }
    }

    // ── 3. Intelligent multi-factor scoring fallback ─────────
    return this._scoringFallback(businesses, preferences);
  }

  async generateText(prompt, fallbackText) {
    if (!isValidGeminiKey(GEMINI_API_KEY)) {
      return { text: fallbackText, source: 'fallback' };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const response = await axios.post(url, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }, { timeout: 15000, headers: { 'Content-Type': 'application/json' } });
      const text = extractGeminiText(response.data).trim();
      if (text) return { text, source: 'gemini-api' };
    } catch (error) {
      logger.warn(`Gemini text generation failed: ${error.message}`);
    }
    return { text: fallbackText, source: 'fallback' };
  }

  /**
   * Query Python FastAPI AI service
   */
  async _queryPythonAIService(businesses, preferences) {
    const res = await axios.post(
      `${PYTHON_AI_SERVICE_URL.replace(/\/$/, '')}/ai/recommend-business`,
      {
        businesses,
        sortBy: preferences.sortBy,
        category: preferences.category,
        maxBudget: preferences.maxBudget,
        minRating: preferences.minRating,
        prompt: preferences.prompt
      },
      { timeout: 10000 }
    );
    return res.data;
  }

  /**
   * Query Google Gemini API.
   * Enforces strict category and budget matching.
   */
  async _queryGemini(businesses, preferences, modelOverride) {
    const { prompt, sortBy, category, maxBudget, minRating } = preferences;
    const modelToUse = modelOverride || GEMINI_MODEL;

    const businessSummaries = businesses.slice(0, 25).map((b, i) => {
      const rating      = b.rating?.average ?? 0;
      const ratingCount = b.rating?.count   ?? 0;
      const baseRate    = b.pricing?.baseRate ?? 0;
      const priceTier   = b.pricing?.priceTier ?? 'standard';
      const city        = b.city || 'N/A';
      const cat         = b.category || 'other';
      return `${i + 1}. "${b.name}" | Category: ${cat} | City: ${city} | Rating: ${rating}/5 (${ratingCount} reviews) | Base Rate: $${baseRate} | Tier: ${priceTier}`;
    }).join('\n');

    const systemInstruction =
      'You are a smart queue management AI assistant. Recommend businesses from the provided list that strictly match the user\'s requested category, price/budget limit, rating, and intent.\n\n' +
      'CRITICAL RULES:\n' +
      '1. STRICT CATEGORY FILTERING: If the user prompt or category parameter specifies a business type (e.g. "salon", "clinic", "grocery", "retail", "restaurant", "bank", "barber", "parlor", "spa"), ONLY include businesses matching that category in ranked_indices. NEVER return a grocery store, clinic, or bank if the user requested a salon!\n' +
      '2. STRICT BUDGET FILTERING: If a budget limit is given in the prompt (e.g. "under $10", "$15 max", "under 10$") or maxBudget parameter, ONLY include businesses whose Base Rate is less than or equal to that budget.\n' +
      '3. NO MATCH HANDLING: If NO business meets BOTH the requested category and budget limit (for example, if all salons cost $18+ and user asked for salon under $10), set "ranked_indices": [] and write a clear "reasoning" explaining that no matching business exists under that price limit (e.g. "No salon businesses found under $10. The lowest base rate for salon services is $18."). Do NOT return mismatched businesses of other categories.\n' +
      '4. FORMAT: Respond with valid JSON only — no markdown code fences. Keys must be "ranked_indices" (array of 1-based integer indices) and "reasoning" (string explanation).';

    const userPrompt =
      `Given these candidate businesses:\n${businessSummaries}\n\n` +
      (prompt ? `User Prompt: "${prompt}"\n` : '') +
      (category && category !== 'all' ? `Category Filter: ${category}\n` : '') +
      (maxBudget ? `Max Budget Limit: $${maxBudget}\n` : '') +
      (minRating ? `Min Rating Limit: ${minRating}\n` : '') +
      `Sort Preference: ${sortBy || 'ai'}\n\n` +
      `Filter and rank ONLY the businesses that strictly satisfy all requested category, budget, and rating constraints. If none match, return ranked_indices as []. Return JSON only.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${GEMINI_API_KEY}`;

    let geminiResponse;
    try {
      geminiResponse = await axios.post(
        url,
        {
          contents: [
            { role: 'user', parts: [{ text: systemInstruction + '\n\n' + userPrompt }] }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json'
          }
        },
        { timeout: 20000, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (axiosErr) {
      const status  = axiosErr.response?.status;
      const errMsg  = axiosErr.response?.data?.error?.message || axiosErr.message;

      if (status === 404 && !modelOverride) {
        logger.warn(`Gemini model "${modelToUse}" unavailable: ${errMsg}. Trying fallback models...`);
        for (const fallbackModel of GEMINI_FALLBACK_MODELS) {
          if (fallbackModel !== modelToUse) {
            try {
              logger.info(`Trying Gemini fallback model: ${fallbackModel}`);
              return await this._queryGemini(businesses, preferences, fallbackModel);
            } catch (fbErr) {
              logger.warn(`Fallback model ${fallbackModel} also failed: ${fbErr.message}`);
            }
          }
        }
      }
      throw new Error(`Gemini API error (HTTP ${status || 'network'}): ${errMsg}`);
    }

    const textContent = extractGeminiText(geminiResponse.data);
    if (!textContent || textContent.trim() === '') {
      throw new Error('Gemini API returned empty content');
    }

    let parsed;
    try {
      const cleaned = textContent.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      logger.warn(`Gemini JSON parse failed. Raw: ${textContent.substring(0, 200)}`);
      throw new Error(`Gemini response JSON parse failed: ${parseErr.message}`);
    }

    const rankedIndices = parsed.ranked_indices || [];
    const reasoning     = parsed.reasoning || (rankedIndices.length ? 'Ranked by Gemini AI' : 'No businesses matched your criteria.');

    const recommendations = rankedIndices
      .filter(idx => idx >= 1 && idx <= businesses.length)
      .map((idx, rank) => {
        const b = businesses[idx - 1];
        return {
          businessId: b._id,
          name:       b.name,
          slug:       b.slug,
          category:   b.category,
          city:       b.city,
          rating:     b.rating,
          pricing:    b.pricing,
          rank:       rank + 1,
          aiScore:    Math.max(0, 100 - rank * 5),
          badges:     this._generateBadges(b)
        };
      });

    return {
      recommendations,
      reasoning,
      source: 'gemini-api',
      model:  modelToUse
    };
  }

  /**
   * Query OpenAI API as alternative provider
   */
  async _queryOpenAI(businesses, preferences) {
    const { prompt, sortBy, category, maxBudget, minRating } = preferences;

    const businessSummaries = businesses.slice(0, 25).map((b, i) => {
      const rating      = b.rating?.average ?? 0;
      const ratingCount = b.rating?.count   ?? 0;
      const baseRate    = b.pricing?.baseRate ?? 0;
      const priceTier   = b.pricing?.priceTier ?? 'standard';
      const city        = b.city || 'N/A';
      const cat         = b.category || 'other';
      return `${i + 1}. "${b.name}" | Category: ${cat} | City: ${city} | Rating: ${rating}/5 (${ratingCount} reviews) | Base Rate: $${baseRate} | Tier: ${priceTier}`;
    }).join('\n');

    const systemMsg = `You are a smart queue management AI assistant. Filter and rank businesses strictly matching the user prompt, category, and budget limit. If none match, return {"ranked_indices": [], "reasoning": "No matching businesses found."}. Respond with valid JSON only.`;
    const userMsg   = `Businesses:\n${businessSummaries}\n\nUser request: "${prompt || 'Recommend best businesses'}"\nCategory: ${category || 'all'}\n${maxBudget ? `Max budget: $${maxBudget}\n` : ''}${minRating ? `Min rating: ${minRating}\n` : ''}`;

    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user',   content: userMsg   }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type':  'application/json'
        },
        timeout: 15000
      }
    );

    const parsed       = JSON.parse(resp.data?.choices?.[0]?.message?.content || '{}');
    const rankedIndices = parsed.ranked_indices || [];
    const reasoning    = parsed.reasoning || 'Ranked by OpenAI';

    const recommendations = rankedIndices
      .filter(idx => idx >= 1 && idx <= businesses.length)
      .map((idx, rank) => {
        const b = businesses[idx - 1];
        return {
          businessId: b._id,
          name:       b.name,
          slug:       b.slug,
          category:   b.category,
          city:       b.city,
          rating:     b.rating,
          pricing:    b.pricing,
          rank:       rank + 1,
          aiScore:    Math.max(0, 100 - rank * 5),
          badges:     this._generateBadges(b)
        };
      });

    return {
      recommendations,
      reasoning,
      source: 'openai-api',
      model:  OPENAI_MODEL
    };
  }

  /**
   * Multi-factor weighted scoring algorithm (fallback — always works, no API needed)
   * Also parses budget and category constraints from user prompt if present.
   */
  _scoringFallback(businesses, preferences) {
    const { sortBy = 'ai', category, maxBudget, minRating, prompt = '' } = preferences;

    let effectiveCategory = category && category !== 'all' ? category : null;
    let effectiveMaxBudget = maxBudget ? Number(maxBudget) : null;
    let effectiveMinRating = minRating ? Number(minRating) : null;

    // Parse category from prompt text if not explicitly set
    if (!effectiveCategory && prompt) {
      const lower = prompt.toLowerCase();
      if (lower.includes('salon') || lower.includes('barber') || lower.includes('parlor') || lower.includes('hair') || lower.includes('spa')) {
        effectiveCategory = 'salon';
      } else if (lower.includes('clinic') || lower.includes('doctor') || lower.includes('health') || lower.includes('hospital')) {
        effectiveCategory = 'clinic';
      } else if (lower.includes('grocery') || lower.includes('supermarket') || lower.includes('mart') || lower.includes('store') || lower.includes('retail')) {
        effectiveCategory = 'retail';
      } else if (lower.includes('restaurant') || lower.includes('cafe') || lower.includes('bistro') || lower.includes('food')) {
        effectiveCategory = 'restaurant';
      } else if (lower.includes('bank') || lower.includes('finance') || lower.includes('teller')) {
        effectiveCategory = 'bank';
      }
    }

    // Parse budget from prompt text if not explicitly set (e.g. "under 10$", "under $10", "below 15")
    if (effectiveMaxBudget === null && prompt) {
      const budgetMatch = prompt.match(/(?:under|below|less than|max)\s*\$?(\d+(?:\.\d+)?)/i) ||
                          prompt.match(/\$?(\d+(?:\.\d+)?)\s*\$?\s*(?:under|below|max)/i);
      if (budgetMatch) {
        effectiveMaxBudget = parseFloat(budgetMatch[1]);
      }
    }

    let filtered = [...businesses];

    if (effectiveCategory) {
      filtered = filtered.filter(b => b.category === effectiveCategory);
    }
    if (effectiveMaxBudget !== null) {
      filtered = filtered.filter(b => (b.pricing?.baseRate ?? 0) <= effectiveMaxBudget);
    }
    if (effectiveMinRating !== null) {
      filtered = filtered.filter(b => (b.rating?.average ?? 0) >= effectiveMinRating);
    }

    if (!filtered.length) {
      let reasonText = 'No businesses match the applied criteria.';
      if (effectiveCategory && effectiveMaxBudget !== null) {
        reasonText = `No ${effectiveCategory} businesses found under $${effectiveMaxBudget}.`;
      } else if (effectiveCategory) {
        reasonText = `No ${effectiveCategory} businesses found matching your criteria.`;
      } else if (effectiveMaxBudget !== null) {
        reasonText = `No businesses found with base rate under $${effectiveMaxBudget}.`;
      }

      return {
        recommendations: [],
        reasoning: reasonText,
        source: 'scoring-algorithm'
      };
    }

    const weights = {
      rating:   { rating: 0.70, price: 0.10, waitTime: 0.10, popularity: 0.10 },
      price:    { rating: 0.10, price: 0.60, waitTime: 0.10, popularity: 0.20 },
      waitTime: { rating: 0.10, price: 0.10, waitTime: 0.70, popularity: 0.10 },
      ai:       { rating: 0.35, price: 0.25, waitTime: 0.25, popularity: 0.15 },
    };
    const w = weights[sortBy] || weights.ai;

    const ratings = filtered.map(b => b.rating?.average  ?? 0);
    const prices  = filtered.map(b => b.pricing?.baseRate ?? 0);
    const counts  = filtered.map(b => b.rating?.count     ?? 0);

    const maxRating = Math.max(...ratings, 1);
    const minPrice  = Math.min(...prices);
    const maxPrice  = Math.max(...prices, 1);
    const maxCount  = Math.max(...counts, 1);

    const scored = filtered.map(b => {
      const ratingScore     = (b.rating?.average  ?? 0) / maxRating;
      const priceScore      = maxPrice > minPrice
        ? 1 - ((b.pricing?.baseRate ?? 0) - minPrice) / (maxPrice - minPrice)
        : 1;
      const popularityScore = (b.rating?.count ?? 0) / maxCount;
      const waitScore       = 0.5;

      const total = (
        w.rating     * ratingScore     +
        w.price      * priceScore      +
        w.waitTime   * waitScore       +
        w.popularity * popularityScore
      );
      return { business: b, score: Math.round(total * 100) };
    });

    scored.sort((a, b) => b.score - a.score);

    const recommendations = scored.slice(0, 10).map((item, rank) => ({
      businessId: item.business._id,
      name:       item.business.name,
      slug:       item.business.slug,
      category:   item.business.category,
      city:       item.business.city,
      rating:     item.business.rating,
      pricing:    item.business.pricing,
      rank:       rank + 1,
      aiScore:    item.score,
      badges:     this._generateBadges(item.business)
    }));

    const sortLabel = { rating: 'Best Rated', price: 'Best Value', waitTime: 'Shortest Wait', ai: 'Smart Rank' };
    return {
      recommendations,
      reasoning: `Ranked by ${sortLabel[sortBy] || 'Smart Rank'} — rating ${Math.round(w.rating * 100)}%, price ${Math.round(w.price * 100)}%, wait ${Math.round(w.waitTime * 100)}%, popularity ${Math.round(w.popularity * 100)}%.`,
      source: 'scoring-algorithm'
    };
  }

  /**
   * Generate display badges for a business.
   */
  _generateBadges(b) {
    const badges = [];
    const avg   = b.rating?.average  ?? 0;
    const count = b.rating?.count    ?? 0;
    const tier  = b.pricing?.priceTier ?? 'standard';

    if (avg >= 4.5 && count >= 10) badges.push({ icon: '⭐', label: 'Top Rated',       color: '#F59E0B' });
    if (avg >= 4.0 && count >= 5)  badges.push({ icon: '👍', label: 'Highly Rated',    color: '#10B981' });
    if (tier === 'budget')         badges.push({ icon: '💰', label: 'Budget Friendly', color: '#22C55E' });
    if (tier === 'premium')        badges.push({ icon: '💎', label: 'Premium',          color: '#8B5CF6' });
    if (tier === 'luxury')         badges.push({ icon: '👑', label: 'Luxury',           color: '#D97706' });
    if (count >= 50)               badges.push({ icon: '🔥', label: 'Popular',          color: '#EF4444' });
    return badges;
  }

  /**
   * Predict wait time for a queue/token (Local dynamic calculation)
   */
  async predictWaitTime(queueId, tokenId, category, priority, activeCounters = 1) {
    const baseTimes = {
      'General':   5,
      'Support':   8,
      'Billing':   6,
      'Technical': 10,
      'Emergency': 3,
      'VIP':       4
    };

    const priorityFactor = priority === 'vip' ? 0.6 : priority === 'emergency' ? 0.3 : 1.0;
    const baseTime = baseTimes[category] || 5;
    const counters = Math.max(activeCounters, 1);

    return {
      estimated_wait_minutes: Math.max(1, Math.round((baseTime * priorityFactor) / counters)),
      confidence_score: 0.85,
      source: 'rule-based'
    };
  }
}

module.exports = new AIService();
