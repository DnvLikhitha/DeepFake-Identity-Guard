"""
DeepFake Identity Guard — FastAPI Backend Server

Provides:
- POST /analyze         — Upload image for deepfake/manipulation detection
- POST /analyze-url     — Analyze image from URL (Supabase signed URLs)
- POST /reverse-search  — Reverse image search via SerpAPI (Google Reverse Image)
- GET  /health          — Health check w/ ML model status
"""

import io
import os
import logging
import traceback

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from typing import Optional

from analyzer import analyze_image

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DeepFake Identity Guard API",
    description="AI-powered deepfake detection and image manipulation analysis",
    version="2.0.0",
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup — preload ML model ──────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Preload the ML model at startup so first request isn't slow."""
    try:
        from ml_model import _load_model
        logger.info("Preloading ML model...")
        _load_model()
    except Exception as e:
        logger.warning(f"ML model preload failed (will retry on first request): {e}")


# ── Models ───────────────────────────────────────────────────────────────────

class AnalyzeUrlRequest(BaseModel):
    image_url: str


class ReverseSearchRequest(BaseModel):
    image_url: Optional[str] = None


class AnalysisResponse(BaseModel):
    mls_score: int
    risk_tier: str
    signal_breakdown: list
    heatmap: Optional[str] = None
    reverse_image_results: Optional[list] = None
    ml_model_used: Optional[bool] = None


class ReverseSearchResponse(BaseModel):
    matches: list
    provider: str
    available: bool
    error: Optional[str] = None
    total_results: int


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    ml_status = "unknown"
    try:
        from ml_model import _model_loaded, _model_error, _classifier
        if _model_loaded and _classifier is not None:
            ml_status = "loaded"
        elif _model_loaded and _classifier is None:
            ml_status = f"unavailable: {_model_error}"
        else:
            ml_status = "not loaded yet"
    except ImportError:
        ml_status = "module not installed"

    # Check reverse search API availability
    serpapi_available = bool(os.getenv("SERPAPI_API_KEY"))

    return {
        "status": "ok",
        "service": "deepfake-identity-guard-api",
        "version": "2.0.0",
        "ml_model": ml_status,
        "reverse_search": {
            "serpapi": serpapi_available,
        },
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_upload(file: UploadFile = File(...)):
    """
    Analyze an uploaded image file for deepfake/manipulation signals.
    Accepts JPEG, PNG, WEBP. Max 5MB.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP",
        )

    # Read file
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Validate size (5MB)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    # Open and analyze
    try:
        image = Image.open(io.BytesIO(contents))
        results = analyze_image(image)
        return AnalysisResponse(**results)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-url", response_model=AnalysisResponse)
async def analyze_url(request: AnalyzeUrlRequest):
    """
    Analyze an image from a URL (e.g., Supabase signed URL).
    Downloads the image and runs analysis.
    """
    if not request.image_url:
        raise HTTPException(status_code=400, detail="image_url is required")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(request.image_url)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch image: HTTP {e.response.status_code}",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")

    # Validate size
    if len(response.content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 5MB.")

    # Open and analyze
    try:
        image = Image.open(io.BytesIO(response.content))
        results = analyze_image(image)
        return AnalysisResponse(**results)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/reverse-search", response_model=ReverseSearchResponse)
async def reverse_search_endpoint(request: ReverseSearchRequest):
    """
    Perform reverse image search to find where an image appears online.
    Uses SerpAPI (Google Reverse Image engine).
    """
    try:
        from reverse_search import reverse_image_search
        results = await reverse_image_search(image_url=request.image_url)
        return ReverseSearchResponse(**results)
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="reverse_search module not available",
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Reverse search failed: {str(e)}")


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

