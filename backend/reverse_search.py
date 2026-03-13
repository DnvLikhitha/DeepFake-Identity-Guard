"""
DeepFake Identity Guard — Reverse Image Search

Integrates with:
1. Google Custom Search JSON API (primary — 100 queries/day free)
2. Bing Visual Search API (fallback — 1,000 transactions/month free)

API keys must be set via environment variables:
- GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX  (Google Custom Search)
- BING_VISUAL_SEARCH_API_KEY          (Bing Visual Search)
"""

import os
import io
import logging
from typing import Optional

import httpx
from PIL import Image

logger = logging.getLogger(__name__)


async def reverse_image_search(
    image_url: Optional[str] = None,
    image: Optional[Image.Image] = None,
) -> dict:
    """
    Perform reverse image search using available APIs.

    Args:
        image_url: Public URL to the image (e.g., Supabase signed URL)
        image: PIL Image object (used for Bing which accepts file upload)

    Returns:
        dict with:
            - matches: list of matched results
            - provider: which API was used
            - available: whether any API was available
            - error: error message if failed
    """
    # Try Google CSE first
    google_results = await _google_cse_search(image_url)
    if google_results["available"]:
        return google_results

    # Fallback to Bing Visual Search
    bing_results = await _bing_visual_search(image_url, image)
    if bing_results["available"]:
        return bing_results

    # No API keys configured
    return {
        "matches": [],
        "provider": "none",
        "available": False,
        "error": "No reverse image search API keys configured. Set GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX or BING_VISUAL_SEARCH_API_KEY in your .env file.",
        "total_results": 0,
    }


async def _google_cse_search(image_url: Optional[str]) -> dict:
    """
    Google Custom Search JSON API — reverse image search.
    Requires: GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX env vars.
    Free tier: 100 queries/day.
    """
    api_key = os.getenv("GOOGLE_CSE_API_KEY")
    cx = os.getenv("GOOGLE_CSE_CX")

    if not api_key or not cx:
        return {
            "matches": [],
            "provider": "google_cse",
            "available": False,
            "error": "Google CSE API key or CX not configured",
            "total_results": 0,
        }

    if not image_url:
        return {
            "matches": [],
            "provider": "google_cse",
            "available": False,
            "error": "Image URL required for Google CSE reverse search",
            "total_results": 0,
        }

    try:
        params = {
            "key": api_key,
            "cx": cx,
            "searchType": "image",
            "q": image_url,  # Use image URL as query for reverse search
            "num": 10,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        matches = []
        for item in data.get("items", []):
            match = {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "display_url": item.get("displayLink", ""),
                "snippet": item.get("snippet", ""),
                "thumbnail": item.get("image", {}).get("thumbnailLink", ""),
                "source_page": item.get("image", {}).get("contextLink", ""),
                "width": item.get("image", {}).get("width"),
                "height": item.get("image", {}).get("height"),
                "similarity": None,  # Google CSE doesn't provide similarity score
            }

            # Flag known risky domains
            match["flagged"] = _is_flagged_domain(match["display_url"])
            matches.append(match)

        total = int(data.get("searchInformation", {}).get("totalResults", 0))

        return {
            "matches": matches,
            "provider": "google_cse",
            "available": True,
            "error": None,
            "total_results": total,
        }

    except httpx.HTTPStatusError as e:
        error_msg = f"Google CSE API error: {e.response.status_code}"
        if e.response.status_code == 429:
            error_msg = "Google CSE daily quota exceeded (100 queries/day)"
        logger.error(error_msg)
        return {
            "matches": [],
            "provider": "google_cse",
            "available": True,
            "error": error_msg,
            "total_results": 0,
        }
    except Exception as e:
        logger.error(f"Google CSE search failed: {e}")
        return {
            "matches": [],
            "provider": "google_cse",
            "available": True,
            "error": str(e),
            "total_results": 0,
        }


async def _bing_visual_search(
    image_url: Optional[str] = None,
    image: Optional[Image.Image] = None,
) -> dict:
    """
    Bing Visual Search API — reverse image search.
    Requires: BING_VISUAL_SEARCH_API_KEY env var.
    Free tier: 1,000 transactions/month.
    """
    api_key = os.getenv("BING_VISUAL_SEARCH_API_KEY")

    if not api_key:
        return {
            "matches": [],
            "provider": "bing",
            "available": False,
            "error": "Bing Visual Search API key not configured",
            "total_results": 0,
        }

    try:
        headers = {"Ocp-Apim-Subscription-Key": api_key}
        matches = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            if image_url:
                # Use URL-based search
                payload = {
                    "imageInfo": {"url": image_url},
                    "knowledgeRequest": {
                        "filters": {"site": ""},
                    },
                }
                response = await client.post(
                    "https://api.bing.microsoft.com/v7.0/images/visualsearch",
                    headers={**headers, "Content-Type": "application/json"},
                    json=payload,
                )
            elif image:
                # Upload image directly
                buf = io.BytesIO()
                image.save(buf, format="JPEG")
                buf.seek(0)

                response = await client.post(
                    "https://api.bing.microsoft.com/v7.0/images/visualsearch",
                    headers=headers,
                    files={"image": ("image.jpg", buf, "image/jpeg")},
                )
            else:
                return {
                    "matches": [],
                    "provider": "bing",
                    "available": True,
                    "error": "No image URL or image data provided",
                    "total_results": 0,
                }

            response.raise_for_status()
            data = response.json()

        # Parse Bing Visual Search results
        tags = data.get("tags", [])
        for tag in tags:
            for action in tag.get("actions", []):
                action_type = action.get("actionType", "")

                if action_type == "PagesIncluding":
                    for item in action.get("data", {}).get("value", [])[:10]:
                        match = {
                            "title": item.get("name", ""),
                            "url": item.get("contentUrl", ""),
                            "display_url": item.get("hostPageDisplayUrl", ""),
                            "snippet": item.get("snippet", ""),
                            "thumbnail": item.get("thumbnailUrl", ""),
                            "source_page": item.get("hostPageUrl", ""),
                            "width": item.get("width"),
                            "height": item.get("height"),
                            "similarity": None,
                        }
                        match["flagged"] = _is_flagged_domain(match["display_url"])
                        matches.append(match)

                elif action_type == "VisualSearch":
                    for item in action.get("data", {}).get("value", [])[:5]:
                        match = {
                            "title": item.get("name", ""),
                            "url": item.get("contentUrl", ""),
                            "display_url": item.get("hostPageDisplayUrl", ""),
                            "snippet": "",
                            "thumbnail": item.get("thumbnailUrl", ""),
                            "source_page": item.get("hostPageUrl", ""),
                            "width": item.get("width"),
                            "height": item.get("height"),
                            "similarity": None,
                        }
                        match["flagged"] = _is_flagged_domain(match["display_url"])
                        matches.append(match)

        return {
            "matches": matches[:10],  # Cap at 10
            "provider": "bing",
            "available": True,
            "error": None,
            "total_results": len(matches),
        }

    except httpx.HTTPStatusError as e:
        error_msg = f"Bing Visual Search API error: {e.response.status_code}"
        if e.response.status_code == 429:
            error_msg = "Bing Visual Search monthly quota exceeded"
        logger.error(error_msg)
        return {
            "matches": [],
            "provider": "bing",
            "available": True,
            "error": error_msg,
            "total_results": 0,
        }
    except Exception as e:
        logger.error(f"Bing Visual Search failed: {e}")
        return {
            "matches": [],
            "provider": "bing",
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
