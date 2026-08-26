"""
business_recommendation.py
─────────────────────────────────────────────
FastAPI route /ai/recommend-business for
Rating & Rate-based Queue and Business Recommendations.
Supports Gemini API with fallback to
multi-factor heuristic scoring vector analysis.
─────────────────────────────────────────────
"""

import os
import re
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Business Recommendations"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6KQ2XnmVta9Ow79d24iWwwE7IMwDixT9RpgxXBk06uQLw").strip()
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Fallback model chain if primary model is unavailable
GEMINI_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]


class PricingModel(BaseModel):
    baseRate:   Optional[float] = 0.0
    hourlyRate: Optional[float] = 0.0
    priceTier:  Optional[str]   = "standard"
    currency:   Optional[str]   = "USD"


class RatingModel(BaseModel):
    average: Optional[float] = 0.0
    count:   Optional[int]   = 0


class BusinessCandidate(BaseModel):
    businessId: Optional[str] = None
    _id:        Optional[str] = None
    name:       str
    slug:       Optional[str] = None
    category:   Optional[str] = "other"
    city:       Optional[str] = None
    rating:     Optional[RatingModel]  = Field(default_factory=RatingModel)
    pricing:    Optional[PricingModel] = Field(default_factory=PricingModel)
    waitTime:   Optional[int]   = 5
    capacity:   Optional[int]   = 100
    queueLength: Optional[int]  = 0


class RecommendationRequest(BaseModel):
    businesses: List[BusinessCandidate]
    sortBy:     Optional[str]   = "ai"   # 'rating', 'price', 'waitTime', 'ai'
    category:   Optional[str]   = None
    maxBudget:  Optional[float] = None
    minRating:  Optional[float] = None
    prompt:     Optional[str]   = None


class Badge(BaseModel):
    icon:  str
    label: str
    color: str


class RecommendedBusiness(BaseModel):
    businessId: Optional[str] = None
    name:       str
    slug:       Optional[str] = None
    category:   Optional[str] = None
    city:       Optional[str] = None
    rating:     Optional[RatingModel]  = None
    pricing:    Optional[PricingModel] = None
    rank:       int
    aiScore:    int
    badges:     List[Badge] = []


class RecommendationResponse(BaseModel):
    recommendations: List[RecommendedBusiness]
    reasoning:       str
    source:          str
    model:           Optional[str] = None


def extract_gemini_text(result_data: dict) -> str:
    """Extract full text from Gemini API response."""
    parts = result_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if isinstance(p.get("text"), str))


def generate_badges(b: BusinessCandidate) -> List[Badge]:
    badges = []
    avg_rating = b.rating.average if b.rating else 0.0
    count = b.rating.count if b.rating else 0
    tier = (b.pricing.priceTier if b.pricing else "standard") or "standard"

    if avg_rating >= 4.5 and count >= 10:
        badges.append(Badge(icon="⭐", label="Top Rated",       color="#F59E0B"))
    elif avg_rating >= 4.0 and count >= 5:
        badges.append(Badge(icon="👍", label="Highly Rated",    color="#10B981"))

    if tier == "budget":
        badges.append(Badge(icon="💰", label="Budget Friendly", color="#22C55E"))
    elif tier == "premium":
        badges.append(Badge(icon="💎", label="Premium",          color="#8B5CF6"))
    elif tier == "luxury":
        badges.append(Badge(icon="👑", label="Luxury",           color="#D97706"))

    if count >= 50:
        badges.append(Badge(icon="🔥", label="Popular",          color="#EF4444"))

    return badges


def multi_factor_scoring(req: RecommendationRequest) -> RecommendationResponse:
    """Fallback scoring with strict prompt category and budget extraction."""
    candidates = req.businesses
    prompt = (req.prompt or "").lower()

    effective_category = req.category if req.category and req.category != "all" else None
    effective_max_budget = req.maxBudget

    if not effective_category and prompt:
        if any(w in prompt for w in ["salon", "barber", "parlor", "hair", "spa"]):
            effective_category = "salon"
        elif any(w in prompt for w in ["clinic", "doctor", "health"]):
            effective_category = "clinic"
        elif any(w in prompt for w in ["grocery", "supermarket", "mart", "store", "retail"]):
            effective_category = "retail"
        elif any(w in prompt for w in ["restaurant", "cafe", "bistro", "food"]):
            effective_category = "restaurant"

    if effective_max_budget is None and prompt:
        m = re.search(r'(?:under|below|less than|max)\s*\$?(\d+(?:\.\d+)?)', prompt) or \
            re.search(r'\$?(\d+(?:\.\d+)?)\s*\$?\s*(?:under|below|max)', prompt)
        if m:
            effective_max_budget = float(m.group(1))

    if effective_category:
        candidates = [c for c in candidates if c.category == effective_category]
    if effective_max_budget is not None:
        candidates = [c for c in candidates if (c.pricing.baseRate or 0) <= effective_max_budget]
    if req.minRating is not None:
        candidates = [c for c in candidates if (c.rating.average or 0) >= req.minRating]

    if not candidates:
        reason_text = "No businesses match the applied criteria."
        if effective_category and effective_max_budget is not None:
            reason_text = f"No {effective_category} businesses found under ${effective_max_budget:g}."
        elif effective_category:
            reason_text = f"No {effective_category} businesses found matching your request."
        elif effective_max_budget is not None:
            reason_text = f"No businesses found with base rate under ${effective_max_budget:g}."

        return RecommendationResponse(
            recommendations=[],
            reasoning=reason_text,
            source="python-scoring-heuristic"
        )

    weights_map = {
        "rating":   {"rating": 0.70, "price": 0.10, "wait": 0.10, "pop": 0.10},
        "price":    {"rating": 0.10, "price": 0.60, "wait": 0.10, "pop": 0.20},
        "waitTime": {"rating": 0.10, "price": 0.10, "wait": 0.70, "pop": 0.10},
        "ai":       {"rating": 0.35, "price": 0.25, "wait": 0.25, "pop": 0.15},
    }
    w = weights_map.get(req.sortBy or "ai", weights_map["ai"])

    ratings = [c.rating.average or 0.0 for c in candidates]
    prices  = [c.pricing.baseRate or 0.0 for c in candidates]
    counts  = [c.rating.count or 0 for c in candidates]
    waits   = [c.waitTime or 5 for c in candidates]

    max_rating = max(ratings) if ratings and max(ratings) > 0 else 5.0
    min_price  = min(prices) if prices else 0.0
    max_price  = max(prices) if prices and max(prices) > min_price else (min_price + 1.0)
    max_count  = max(counts) if counts and max(counts) > 0 else 1
    max_wait   = max(waits)  if waits  and max(waits)  > 0 else 30

    scored = []
    for c in candidates:
        r_score   = (c.rating.average or 0.0) / max_rating
        p_score   = 1.0 - (((c.pricing.baseRate or 0.0) - min_price) / (max_price - min_price)) if max_price > min_price else 1.0
        pop_score = (c.rating.count or 0) / max_count
        w_score   = 1.0 - min(1.0, (c.waitTime or 5) / max_wait)

        total = (w["rating"] * r_score + w["price"] * p_score +
                 w["wait"]   * w_score + w["pop"]   * pop_score)
        scored.append((c, int(round(total * 100))))

    scored.sort(key=lambda item: item[1], reverse=True)

    recommendations = []
    for rank, (cand, score) in enumerate(scored[:10], start=1):
        b_id = cand.businessId or cand._id
        recommendations.append(RecommendedBusiness(
            businessId=b_id,
            name=cand.name, slug=cand.slug, category=cand.category, city=cand.city,
            rating=cand.rating, pricing=cand.pricing,
            rank=rank, aiScore=score, badges=generate_badges(cand)
        ))

    return RecommendationResponse(
        recommendations=recommendations,
        reasoning=f"Ranked by Smart Rank based on customer rating ({int(w['rating']*100)}%), service rates ({int(w['price']*100)}%), and review volume ({int(w['pop']*100)}%).",
        source="python-scoring-heuristic"
    )


def call_gemini_api(summaries: str, req: RecommendationRequest, model: str) -> dict:
    """Call Gemini API with strict category and budget instructions."""
    system_instruction = (
        "You are a smart queue AI advisor. Recommend businesses from the provided list that strictly match the user's requested category, price/budget limit, rating, and intent.\n\n"
        "CRITICAL RULES:\n"
        "1. STRICT CATEGORY FILTERING: If the user prompt or category parameter specifies a business type (e.g. 'salon', 'clinic', 'grocery', 'retail', 'restaurant', 'bank', 'barber', 'parlor', 'spa'), ONLY include businesses matching that category in ranked_indices. NEVER return a grocery store, clinic, or bank if the user requested a salon!\n"
        "2. STRICT BUDGET FILTERING: If a budget limit is given in the prompt (e.g. 'under $10', '$15 max', 'under 10$') or maxBudget parameter, ONLY include businesses whose Base Rate is less than or equal to that budget.\n"
        "3. NO MATCH HANDLING: If NO business meets BOTH the requested category and budget limit (for example, if all salons cost $18+ and user asked for salon under $10), set 'ranked_indices': [] and write a clear 'reasoning' explaining that no matching business exists under that price limit (e.g. 'No salon businesses found under $10. The lowest base rate for salon services is $18.'). Do NOT return mismatched businesses of other categories.\n"
        "4. FORMAT: Respond with valid JSON only. Keys must be 'ranked_indices' (array of 1-based integer indices) and 'reasoning' (string explanation)."
    )
    user_prompt = (
        f"Businesses:\n{summaries}\n\n"
        f"Request Prompt: \"{req.prompt or ''}\"\n"
        f"Category Filter: {req.category or 'all'}\n"
        f"Max Budget: {req.maxBudget or 'None'}\n"
        f"Min Rating: {req.minRating or 'None'}\n"
        f"Sort: {req.sortBy or 'ai'}\n\n"
        "Filter and rank ONLY the businesses that strictly satisfy all requested category, budget, and rating constraints. If none match, return ranked_indices as []. Return JSON only."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    payload = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": system_instruction + "\n\n" + user_prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024, "responseMimeType": "application/json"}
    }).encode("utf-8")

    request = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        result_data = json.loads(response.read().decode("utf-8"))

    text = extract_gemini_text(result_data)
    if not text or not text.strip():
        raise ValueError("Gemini API returned empty content")

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[-1] if cleaned.count("```") >= 2 else cleaned
        cleaned = cleaned.lstrip("json").strip()

    return json.loads(cleaned)


@router.post("/recommend-business", response_model=RecommendationResponse)
async def recommend_business(req: RecommendationRequest):
    if not req.businesses:
        return RecommendationResponse(
            recommendations=[],
            reasoning="No business candidates provided.",
            source="empty"
        )

    summaries = []
    for i, b in enumerate(req.businesses[:25], 1):
        avg  = b.rating.average  if b.rating  else 0.0
        cnt  = b.rating.count    if b.rating  else 0
        rate = b.pricing.baseRate if b.pricing else 0.0
        tier = b.pricing.priceTier if b.pricing else "standard"
        summaries.append(
            f'{i}. "{b.name}" | Category: {b.category} | '
            f'Rating: {avg}/5 ({cnt} reviews) | Base Rate: ${rate} | '
            f'Tier: {tier} | Wait: {b.waitTime or 5} min'
        )
    summaries_str = "\n".join(summaries)

    if GEMINI_API_KEY and len(GEMINI_API_KEY) > 10:
        tried_models = []
        models_to_try = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]

        for model in models_to_try:
            if model in tried_models:
                continue
            tried_models.append(model)
            try:
                parsed = call_gemini_api(summaries_str, req, model)
                ranked_indices = parsed.get("ranked_indices", [])
                reasoning      = parsed.get("reasoning", "Ranked by Gemini AI")

                recommendations = []
                for rank, idx in enumerate(ranked_indices, start=1):
                    if 1 <= idx <= len(req.businesses):
                        b = req.businesses[idx - 1]
                        recommendations.append(RecommendedBusiness(
                            businessId=b.businessId or b._id,
                            name=b.name, slug=b.slug, category=b.category, city=b.city,
                            rating=b.rating, pricing=b.pricing,
                            rank=rank, aiScore=max(0, 100 - (rank - 1) * 5),
                            badges=generate_badges(b)
                        ))

                return RecommendationResponse(
                    recommendations=recommendations,
                    reasoning=reasoning,
                    source="gemini-api",
                    model=model
                )

            except Exception as e:
                logger.warning(f"Gemini API failed for model {model}: {e}")

    return multi_factor_scoring(req)
