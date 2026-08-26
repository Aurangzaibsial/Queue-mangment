# Google Gemini AI Integration Guide

## Overview
Naubex directly utilizes **Google Gemini API** (`gemini-2.0-flash`) for AI-powered business recommendations, natural language search matching, and smart rankings. All other external machine learning services and microservices have been removed for simplicity, speed, and reduced operational overhead.

---

## Architecture

```
Customer / Browser → Node.js Express Backend → Google Gemini API
                             ↓
                          MongoDB
```

---

## How It Works

### 1. Direct Gemini API Integration
- **File**: [`smart-queue-backend/services/aiService.js`](file:///c:/Users/Muhammad%20Aurangzaib/Desktop/Queue1/Queue-mangment/smart-queue-backend/services/aiService.js)
- **Model**: `gemini-2.0-flash`
- **Method**: Sends structured prompts with candidate businesses and customer queries, receiving JSON-ranked recommendations with natural AI reasoning.
- **Fallback**: If `GEMINI_API_KEY` is not set or network fails, an intelligent in-memory multi-factor scoring algorithm ranks businesses based on ratings, pricing tiers, and queue dynamics.

### 2. Business Recommendations Endpoint
- **Route**: `POST /api/ai/recommendations`
- **Payload**:
  ```json
  {
    "sortBy": "ai",
    "category": "clinic",
    "maxBudget": 50,
    "minRating": 4.0,
    "prompt": "Find me the best family dental care clinic open today"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "recommendations": [ ... ],
      "reasoning": "Ranked based on proximity, high ratings, and positive reviews.",
      "source": "gemini-api",
      "model": "gemini-2.0-flash"
    }
  }
  ```

---

## Configuration

Add your Gemini API Key in `smart-queue-backend/.env`:

```bash
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash
```
