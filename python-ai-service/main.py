"""
main.py
─────────────────────────────────────────────
FastAPI Application Entry Point for Naubex
AI Microservice.
─────────────────────────────────────────────
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from business_recommendation import router as business_recommendation_router
from queue_ml_model import model_status

app = FastAPI(
    title="Naubex AI Recommendation Microservice",
    description="Microservice for rating and rate-based queue & business recommendations",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register recommendation router
app.include_router(business_recommendation_router)


@app.get("/health")
async def health_check():
    gemini_key = bool(os.getenv("GEMINI_API_KEY", "").strip())
    openai_key = bool(os.getenv("OPENAI_API_KEY", "").strip())
    return {
        "status": "healthy",
        "service": "naubex-ai-microservice",
        "gemini_configured": gemini_key,
        "openai_configured": openai_key,
        "queue_ml_model": model_status(),
        "fallback_scoring_active": True
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
