"""
DeepFake Identity Guard — Reverse Image Search

Integrates with SerpAPI (Google Reverse Image engine).

API key must be set via environment variables:
- SERPAPI_API_KEY
"""

import os
import logging
from typing import Optional
from urllib.parse import urlparse

import httpx
from PIL import Image

logger = logging.getLogger(__name__)


async def reverse_image_search(
    image_url: Optional[str] = None,
    image: Optional[Image.Image] = None,
) -> dict:
    """
    Perform reverse image search using SerpAPI.

    Args:
        image_url: Public URL to the image (e.g., Supabase signed URL)
        image: PIL Image object (currently unused; SerpAPI requires a URL)

    Returns:
        dict with:
            - matches: list of matched results
            - provider: which API was used
            - available: whether the API key is configured
            - error: error message if failed
    """
    return await _serpapi_reverse_image(image_url, image)


async def _serpapi_reverse_image(
    image_url: Optional[str],
    image: Optional[Image.Image],
) -> dict:
    """
    SerpAPI — Google Reverse Image engine.
    Requires: SERPAPI_API_KEY env var.
    """
    api_key = os.getenv("SERPAPI_API_KEY")

    if not api_key:
        return {
            "matches": [],
            "provider": "serpapi",
            "available": False,
            "error": "SERPAPI_API_KEY not configured",
            "total_results": 0,
        }

    if not image_url:
        return {
            "matches": [],
            "provider": "serpapi",
            "available": True,
            "error": "Image URL required for SerpAPI reverse search",
            "total_results": 0,
        }

    if image is not None:
        # SerpAPI Google Reverse Image engine does not accept raw uploads
        logger.info("Ignoring image upload; SerpAPI requires image_url")

    try:
        params = {
            "engine": "google_reverse_image",
            "image_url": image_url,
            "api_key": api_key,
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get("https://serpapi.com/search.json", params=params)
            response.raise_for_status()
            data = response.json()

        if data.get("error"):
            return {
                "matches": [],
                "provider": "serpapi",
                "available": True,
                "error": data.get("error"),
                "total_results": 0,
            }

        matches = []
        for item in (data.get("image_results") or data.get("inline_images") or []):
            url = item.get("link") or item.get("source") or item.get("original") or ""
            display_url = item.get("source") or _extract_domain(url)
            match = {
                "title": item.get("title") or item.get("snippet") or "",
                "url": url,
                "display_url": display_url,
                "snippet": item.get("snippet", ""),
                "thumbnail": item.get("thumbnail") or item.get("original") or "",
                "source_page": item.get("source") or url,
                "width": item.get("width"),
                "height": item.get("height"),
                "similarity": item.get("similarity"),
            }
            match["flagged"] = _is_flagged_domain(display_url)
            matches.append(match)

        total = data.get("search_information", {}).get("total_results")
        try:
            total_results = int(total) if total is not None else len(matches)
        except (TypeError, ValueError):
            total_results = len(matches)

        return {
            "matches": matches[:10],
            "provider": "serpapi",
            "available": True,
            "error": None,
            "total_results": total_results,
        }

    except httpx.HTTPStatusError as e:
        error_msg = f"SerpAPI error: {e.response.status_code}"
        if e.response.status_code == 429:
            error_msg = "SerpAPI quota exceeded"
        logger.error(error_msg)
        return {
            "matches": [],
            "provider": "serpapi",
            "available": True,
            "error": error_msg,
            "total_results": 0,
        }
    except Exception as e:
        logger.error(f"SerpAPI reverse search failed: {e}")
        return {
            "matches": [],
            "provider": "serpapi",
            "available": True,
            "error": str(e),
            "total_results": 0,
        }


# ── Flagged Domains ──────────────────────────────────────────────────────────

# Known platforms associated with NCII, harassment, or paste sites
_FLAGGED_DOMAINS = {
    "pornhub", "xvideos", "xnxx", "xhamster", "redtube", "youporn",
    "4chan", "8kun", "kiwifarms", "pastebin", "hastebin",
    "anonfiles", "mega.nz", "mediafire",
    "deepfake", "fakeapp", "mrdeepfakes",
}


def _is_flagged_domain(display_url: str) -> bool:
    """Check if a URL domain is on the flagged list."""
    if not display_url:
        return False
    domain = display_url.lower().split("/")[0]
    return any(flagged in domain for flagged in _FLAGGED_DOMAINS)


def _extract_domain(url: str) -> str:
    """Extract hostname for display/flag checks."""
    if not url:
        return ""
    parsed = urlparse(url)
    return parsed.netloc or parsed.path.split("/")[0]
