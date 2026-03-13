"""
DeepFake Identity Guard — ML Model Integration

Uses a pre-trained deepfake detection model based on EfficientNet-B4
via HuggingFace transformers pipeline.

Primary model: dima806/deepfake_vs_real_image_detection (EfficientNet-based)
Fallback: Manual EfficientNet-B4 via timm with ImageNet features + heuristic scoring

Model downloads are cached locally after first run (~80MB).
"""

import io
import logging
from PIL import Image
from typing import Optional

logger = logging.getLogger(__name__)

# Global model reference (lazy loaded)
_classifier = None
_model_loaded = False
_model_error = None


def _load_model():
    """Lazy-load the deepfake detection model."""
    global _classifier, _model_loaded, _model_error

    if _model_loaded:
        return _classifier

    # Try HuggingFace transformers pipeline (primary)
    try:
        from transformers import pipeline
        logger.info("Loading deepfake detection model from HuggingFace...")
        _classifier = pipeline(
            "image-classification",
            model="dima806/deepfake_vs_real_image_detection",
            device=-1,  # CPU only (free tier)
        )
        _model_loaded = True
        logger.info("✓ Deepfake detection model loaded successfully")
        return _classifier
    except Exception as e:
        logger.warning(f"HuggingFace model load failed: {e}")

    # Try timm EfficientNet-B4 as fallback
    try:
        import timm
        import torch
        from torchvision import transforms

        logger.info("Loading EfficientNet-B4 via timm as fallback...")
        model = timm.create_model("efficientnet_b4", pretrained=True)
        model.eval()

        # We'll use the model's feature embeddings for anomaly scoring
        _classifier = {
            "type": "timm",
            "model": model,
            "transform": transforms.Compose([
                transforms.Resize((380, 380)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
            ]),
        }
        _model_loaded = True
        logger.info("✓ EfficientNet-B4 (timm) loaded as fallback")
        return _classifier
    except Exception as e2:
        logger.warning(f"timm fallback also failed: {e2}")
        _model_error = str(e2)
        _model_loaded = True  # Don't retry
        return None


def predict_deepfake(image: Image.Image) -> dict:
    """
    Run ML-based deepfake detection on an image.

    Returns:
        dict with keys:
            - ml_score (0-100): manipulation likelihood from ML model
            - ml_confidence (float): raw model confidence
            - ml_label (str): "fake" or "real"
            - ml_model (str): model name used
            - ml_available (bool): whether ML was actually used
            - detail (str): human-readable explanation
    """
    classifier = _load_model()

    if classifier is None:
        return {
            "ml_score": None,
            "ml_confidence": None,
            "ml_label": None,
            "ml_model": "none",
            "ml_available": False,
            "detail": f"ML model unavailable: {_model_error or 'install transformers & torch'}",
        }

    # Ensure RGB
    if image.mode != "RGB":
        image = image.convert("RGB")

    # ── HuggingFace transformers pipeline ─────────────────────────────────
    if not isinstance(classifier, dict):
        try:
            results = classifier(image)
            # results is a list like:
            # [{"label": "Fake", "score": 0.92}, {"label": "Real", "score": 0.08}]

            fake_score = 0.0
            real_score = 0.0
            for r in results:
                label = r["label"].lower()
                if "fake" in label or "deepfake" in label:
                    fake_score = r["score"]
                elif "real" in label:
                    real_score = r["score"]

            # If no explicit fake/real labels, use first result
            if fake_score == 0.0 and real_score == 0.0 and len(results) > 0:
                fake_score = results[0]["score"]
                real_score = 1.0 - fake_score

            ml_score = int(fake_score * 100)
            ml_label = "fake" if fake_score > real_score else "real"

            if ml_score >= 75:
                detail = f"ML model strongly indicates manipulation (confidence: {fake_score:.1%})"
            elif ml_score >= 50:
                detail = f"ML model suggests possible manipulation (confidence: {fake_score:.1%})"
            elif ml_score >= 25:
                detail = f"ML model shows low manipulation indicators (confidence: {fake_score:.1%})"
            else:
                detail = f"ML model indicates image appears authentic (confidence: {real_score:.1%})"

            return {
                "ml_score": ml_score,
                "ml_confidence": round(fake_score, 4),
                "ml_label": ml_label,
                "ml_model": "dima806/deepfake_vs_real_image_detection",
                "ml_available": True,
                "detail": detail,
            }
        except Exception as e:
            logger.error(f"HuggingFace inference failed: {e}")
            return {
                "ml_score": None,
                "ml_confidence": None,
                "ml_label": None,
                "ml_model": "dima806/deepfake_vs_real_image_detection",
                "ml_available": False,
                "detail": f"ML inference error: {str(e)}",
            }

    # ── timm EfficientNet-B4 fallback ─────────────────────────────────────
    try:
        import torch

        model = classifier["model"]
        transform = classifier["transform"]

        input_tensor = transform(image).unsqueeze(0)

        with torch.no_grad():
            output = model(input_tensor)
            probabilities = torch.nn.functional.softmax(output, dim=1)

            # Use top predictions' entropy as an anomaly indicator
            # Real photos tend to have confident classifications;
            # AI-generated images often produce unusual probability distributions
            top_probs, _ = torch.topk(probabilities, 5)
            entropy = -torch.sum(top_probs * torch.log(top_probs + 1e-10)).item()

            # Normalize entropy to 0-100 score
            # Higher entropy = more uncertain = more likely manipulated
            max_entropy = -5 * (0.2 * (-1.6094))  # max entropy for uniform top-5
            ml_score = min(100, int((entropy / max_entropy) * 100))

            # Also check if any single class dominates (real photos usually do)
            top_conf = top_probs[0][0].item()
            if top_conf > 0.7:
                ml_score = max(0, ml_score - 20)  # Confident = more likely real

        ml_label = "fake" if ml_score > 50 else "real"
        detail = (
            f"EfficientNet-B4 feature analysis — anomaly score: {ml_score}/100 "
            f"(top class confidence: {top_conf:.1%})"
        )

        return {
            "ml_score": ml_score,
            "ml_confidence": round(ml_score / 100, 4),
            "ml_label": ml_label,
            "ml_model": "timm/efficientnet_b4",
            "ml_available": True,
            "detail": detail,
        }
    except Exception as e:
        logger.error(f"timm inference failed: {e}")
        return {
            "ml_score": None,
            "ml_confidence": None,
            "ml_label": None,
            "ml_model": "timm/efficientnet_b4",
            "ml_available": False,
            "detail": f"ML inference error: {str(e)}",
        }
