import io
import base64
import struct
import math
import logging
from PIL import Image, ImageChops, ImageFilter, ImageStat
from typing import Optional

logger = logging.getLogger(__name__)


def analyze_image(image: Image.Image) -> dict:
    """
    Run full analysis pipeline on an image.
    Combines heuristic signals + ML model prediction into composite MLS score.
    """
    signals = []

    # 1. EXIF Metadata Analysis
    exif_result = analyze_exif(image)
    signals.append(exif_result)

    # 2. Error Level Analysis (ELA)
    ela_result, ela_heatmap = analyze_ela(image)
    signals.append(ela_result)

    # 3. Compression Artifact Analysis
    compression_result = analyze_compression(image)
    signals.append(compression_result)

    # 4. Noise Pattern Analysis
    noise_result = analyze_noise(image)
    signals.append(noise_result)

    # 5. Color Consistency Analysis
    color_result = analyze_color_consistency(image)
    signals.append(color_result)

    # 6. Edge / Boundary Analysis
    edge_result = analyze_edges(image)
    signals.append(edge_result)

    # 7. ML Model Prediction (EfficientNet-B4 / HuggingFace deepfake detector)
    ml_result = _get_ml_signal(image)
    ml_available = ml_result is not None
    if ml_result:
        signals.append(ml_result)

    # Compute composite MLS score
    if ml_available:
        # With ML: ML gets 30% weight, heuristics share 70%
        heuristic_weights = [0.12, 0.18, 0.10, 0.10, 0.08, 0.12]
        heuristic_score = sum(s["score"] * w for s, w in zip(signals[:6], heuristic_weights))
        ml_score_weighted = ml_result["score"] * 0.30
        mls_score = round(heuristic_score + ml_score_weighted)
    else:
        # Without ML: heuristic-only scoring
        heuristic_weights = [0.20, 0.25, 0.15, 0.15, 0.10, 0.15]
        mls_score = round(sum(s["score"] * w for s, w in zip(signals[:6], heuristic_weights)))

    mls_score = min(100, max(0, mls_score))

    # Determine risk tier
    if mls_score >= 75:
        risk_tier = "Critical"
    elif mls_score >= 55:
        risk_tier = "High"
    elif mls_score >= 35:
        risk_tier = "Moderate"
    else:
        risk_tier = "Low"

    # Generate heatmap as base64
    heatmap_b64 = None
    if ela_heatmap:
        buf = io.BytesIO()
        ela_heatmap.save(buf, format="PNG")
        heatmap_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {
        "mls_score": mls_score,
        "risk_tier": risk_tier,
        "signal_breakdown": signals,
        "heatmap": heatmap_b64,
        "reverse_image_results": None,
        "ml_model_used": ml_available,
    }


def _get_ml_signal(image: Image.Image) -> Optional[dict]:
    """Try to get ML model prediction and format as a signal."""
    try:
        from ml_model import predict_deepfake
        result = predict_deepfake(image)

        if not result["ml_available"]:
            logger.info(f"ML model unavailable: {result['detail']}")
            return None

        # Convert ML result to standard signal format
        score = result["ml_score"]
        if score >= 60:
            status = "warning"
        elif score >= 30:
            status = "moderate"
        else:
            status = "ok"

        return {
            "name": f"ML Detection ({result['ml_model'].split('/')[-1]})",
            "status": status,
            "score": score,
            "detail": result["detail"],
        }
    except ImportError:
        logger.warning("ml_model module not found — skipping ML detection")
        return None
    except Exception as e:
        logger.error(f"ML model error: {e}")
        return None


def analyze_exif(image: Image.Image) -> dict:
    """Analyze EXIF metadata for anomalies."""
    exif_data = image.getexif()
    info = image.info

    issues = []
    score = 0

    if not exif_data or len(exif_data) == 0:
        issues.append("No EXIF metadata found")
        score += 40
    else:
        # Check for common EXIF tags
        # 271 = Make, 272 = Model, 306 = DateTime, 36867 = DateTimeOriginal
        has_camera = 271 in exif_data or 272 in exif_data
        has_datetime = 306 in exif_data or 36867 in exif_data

        if not has_camera:
            issues.append("No camera/device information")
            score += 25
        if not has_datetime:
            issues.append("No original datetime stamp")
            score += 20

        # Check for editing software tags
        # 305 = Software
        software = exif_data.get(305, "")
        if isinstance(software, str):
            editing_tools = ["photoshop", "gimp", "lightroom", "snapseed", "pixlr",
                             "canva", "adobe", "affinity"]
            for tool in editing_tools:
                if tool in software.lower():
                    issues.append(f"Editing software detected: {software}")
                    score += 30
                    break

        # Too few EXIF fields is suspicious for a "real" photo
        if len(exif_data) < 5:
            issues.append("EXIF metadata appears stripped or minimal")
            score += 15

    score = min(100, score)

    if not issues:
        detail = "EXIF metadata appears intact with camera and timestamp info"
        status = "ok"
    elif score < 40:
        detail = "; ".join(issues)
        status = "moderate"
    else:
        detail = "; ".join(issues)
        status = "warning"

    return {
        "name": "EXIF Metadata",
        "status": status,
        "score": score,
        "detail": detail,
    }


def analyze_ela(image: Image.Image) -> tuple:
    """
    Error Level Analysis — re-compress the image and compare
    to detect regions that were modified after initial compression.
    """
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Re-save at quality 95 and compare
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=95)
    buf.seek(0)
    resaved = Image.open(buf)

    # Compute difference
    diff = ImageChops.difference(image, resaved)

    # Amplify the difference for visualization
    extrema = diff.getextrema()
    max_diff = max(ex[1] for ex in extrema) if extrema else 1
    if max_diff == 0:
        max_diff = 1

    scale = 255.0 / max_diff
    ela_image = diff.point(lambda x: min(255, int(x * scale)))

    # Analyze the ELA image for anomalies
    stat = ImageStat.Stat(diff)
    mean_diff = sum(stat.mean) / len(stat.mean)
    stddev_diff = sum(stat.stddev) / len(stat.stddev)

    # High stddev in ELA suggests inconsistent compression = possible manipulation
    score = 0
    issues = []

    if stddev_diff > 15:
        score += 50
        issues.append("Significant compression inconsistencies detected")
    elif stddev_diff > 8:
        score += 30
        issues.append("Minor compression inconsistencies detected")
    elif stddev_diff > 4:
        score += 15
        issues.append("Slight compression variations")

    if mean_diff > 10:
        score += 25
        issues.append("High average error level across image")
    elif mean_diff > 5:
        score += 10
        issues.append("Moderate error levels detected")

    # Check for localized high-error regions (potential splicing)
    # Divide image into quadrants and check variance
    w, h = diff.size
    quadrants = [
        diff.crop((0, 0, w // 2, h // 2)),
        diff.crop((w // 2, 0, w, h // 2)),
        diff.crop((0, h // 2, w // 2, h)),
        diff.crop((w // 2, h // 2, w, h)),
    ]
    q_means = [sum(ImageStat.Stat(q).mean) / 3 for q in quadrants]
    q_variance = sum((m - sum(q_means) / 4) ** 2 for m in q_means) / 4

    if q_variance > 20:
        score += 20
        issues.append("Localized error clusters suggest region-level editing")
    elif q_variance > 8:
        score += 10
        issues.append("Some spatial variation in error levels")

    score = min(100, score)

    if not issues:
        detail = "Error levels are consistent — no signs of splicing or re-editing"
        status = "ok"
    elif score < 40:
        detail = "; ".join(issues)
        status = "moderate"
    else:
        detail = "; ".join(issues)
        status = "warning"

    return (
        {
            "name": "Error Level Analysis",
            "status": status,
            "score": score,
            "detail": detail,
        },
        ela_image,
    )


def analyze_compression(image: Image.Image) -> dict:
    """Detect double compression and JPEG artifact patterns."""
    score = 0
    issues = []

    # Check format
    fmt = image.format
    if fmt == "JPEG" or fmt == "JPG":
        # Check quantization tables if available
        quant = image.quantization if hasattr(image, "quantization") else None
        if quant:
            # Multiple quantization tables can indicate double compression
            if len(quant) > 2:
                score += 30
                issues.append("Multiple quantization tables detected — possible double compression")
            else:
                # Check quality from quantization table values
                avg_q = sum(sum(t) if hasattr(t, '__iter__') else t for t in quant.values()) / max(len(quant), 1)
                if isinstance(avg_q, (int, float)) and avg_q > 5000:
                    score += 15
                    issues.append("Low quality compression detected")
        else:
            score += 10
            issues.append("No quantization table found — unusual for JPEG")
    elif fmt == "PNG":
        # PNG shouldn't have JPEG artifacts, but check for re-encoding signs
        score += 5
        issues.append("PNG format — no JPEG compression analysis applicable")
    else:
        score += 10
        issues.append(f"Format: {fmt or 'unknown'} — limited compression analysis")

    # Check for blockiness (8x8 DCT block artifacts)
    if image.mode != "RGB":
        gray = image.convert("L")
    else:
        gray = image.convert("L")

    # Simple blockiness detection using edge differences at 8px intervals
    w, h = gray.size
    if w > 16 and h > 16:
        pixels = list(gray.getdata())
        block_diffs = []
        for y in range(0, min(h, 200), 8):
            for x in range(0, min(w, 200) - 1):
                idx = y * w + x
                if idx + 1 < len(pixels):
                    block_diffs.append(abs(pixels[idx] - pixels[idx + 1]))

        if block_diffs:
            avg_block = sum(block_diffs) / len(block_diffs)
            if avg_block > 25:
                score += 20
                issues.append("Strong block artifacts detected suggesting aggressive compression")
            elif avg_block > 15:
                score += 10
                issues.append("Moderate block artifacts present")

    score = min(100, score)

    if not issues:
        detail = "Compression patterns appear normal"
        status = "ok"
    elif score < 40:
        detail = "; ".join(issues)
        status = "moderate"
    else:
        detail = "; ".join(issues)
        status = "warning"

    return {
        "name": "Compression Artifacts",
        "status": status,
        "score": score,
        "detail": detail,
    }


def analyze_noise(image: Image.Image) -> dict:
    """Analyze noise patterns for inconsistencies suggesting manipulation."""
    if image.mode != "RGB":
        image = image.convert("RGB")

    score = 0
    issues = []

    # High-pass filter to extract noise
    blurred = image.filter(ImageFilter.GaussianBlur(radius=2))
    noise = ImageChops.difference(image, blurred)

    # Analyze noise statistics
    stat = ImageStat.Stat(noise)
    noise_mean = sum(stat.mean) / 3
    noise_stddev = sum(stat.stddev) / 3

    # Check noise consistency across regions
    w, h = noise.size
    regions = [
        noise.crop((0, 0, w // 3, h // 3)),
        noise.crop((w // 3, 0, 2 * w // 3, h // 3)),
        noise.crop((2 * w // 3, 0, w, h // 3)),
        noise.crop((0, h // 3, w // 3, 2 * h // 3)),
        noise.crop((w // 3, h // 3, 2 * w // 3, 2 * h // 3)),
        noise.crop((2 * w // 3, h // 3, w, 2 * h // 3)),
        noise.crop((0, 2 * h // 3, w // 3, h)),
        noise.crop((w // 3, 2 * h // 3, 2 * w // 3, h)),
        noise.crop((2 * w // 3, 2 * h // 3, w, h)),
    ]

    region_means = []
    for r in regions:
        rstat = ImageStat.Stat(r)
        region_means.append(sum(rstat.mean) / 3)

    if region_means:
        mean_of_means = sum(region_means) / len(region_means)
        variance = sum((m - mean_of_means) ** 2 for m in region_means) / len(region_means)

        if variance > 5:
            score += 45
            issues.append("Significant noise inconsistency across image regions — suggests compositing")
        elif variance > 2:
            score += 25
            issues.append("Moderate noise variation between regions")
        elif variance > 0.8:
            score += 10
            issues.append("Slight noise variation — likely natural")

    # Very low noise can indicate AI generation (too smooth)
    if noise_mean < 1.5:
        score += 30
        issues.append("Unusually low noise floor — possible AI-generated image")
    elif noise_mean < 3:
        score += 10
        issues.append("Low noise level — may indicate heavy processing")

    score = min(100, score)

    if not issues:
        detail = "Noise patterns appear consistent across the image"
        status = "ok"
    elif score < 40:
        detail = "; ".join(issues)
        status = "moderate"
    else:
        detail = "; ".join(issues)
        status = "warning"

    return {
        "name": "Noise Pattern Analysis",
        "status": status,
        "score": score,
        "detail": detail,
    }


def analyze_color_consistency(image: Image.Image) -> dict:
    """Check for color/lighting inconsistencies suggesting compositing."""
    if image.mode != "RGB":
        image = image.convert("RGB")

    score = 0
    issues = []

    w, h = image.size

    # Split into regions and compare color distributions
    top_half = image.crop((0, 0, w, h // 2))
    bottom_half = image.crop((0, h // 2, w, h))
    left_half = image.crop((0, 0, w // 2, h))
    right_half = image.crop((w // 2, 0, w, h))

    pairs = [
        ("top/bottom", top_half, bottom_half),
        ("left/right", left_half, right_half),
    ]

    for label, img1, img2 in pairs:
        stat1 = ImageStat.Stat(img1)
        stat2 = ImageStat.Stat(img2)

        # Compare mean color values
        color_diff = sum(abs(m1 - m2) for m1, m2 in zip(stat1.mean, stat2.mean)) / 3

        # Compare standard deviations (texture variation)
        std_diff = sum(abs(s1 - s2) for s1, s2 in zip(stat1.stddev, stat2.stddev)) / 3

        if color_diff > 40:
            score += 20
            issues.append(f"Significant color difference between {label} regions")
        elif color_diff > 25:
            score += 8
            issues.append(f"Moderate color shift between {label} regions")

        if std_diff > 30:
            score += 15
            issues.append(f"Texture variance mismatch between {label}")

    # Check for unnatural color ranges
    stat = ImageStat.Stat(image)
    for i, channel in enumerate(["R", "G", "B"]):
        if stat.stddev[i] < 10:
            score += 10
            issues.append(f"Very low {channel} channel variance — possible flat rendering")
            break

    score = min(100, score)

    if not issues:
        detail = "Color distribution and lighting appear consistent"
        status = "ok"
    elif score < 40:
        detail = "; ".join(issues)
        status = "moderate"
    else:
        detail = "; ".join(issues)
        status = "warning"

    return {
        "name": "Color Consistency",
        "status": status,
        "score": score,
        "detail": detail,
    }


def analyze_edges(image: Image.Image) -> dict:
    """Analyze edge patterns for blending/splicing boundaries."""
    if image.mode != "RGB":
        image = image.convert("RGB")

    score = 0
    issues = []

    gray = image.convert("L")

    # Apply edge detection
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_stat = ImageStat.Stat(edges)
    edge_mean = edge_stat.mean[0]
    edge_stddev = edge_stat.stddev[0]

    # Very high edge density can indicate AI artifacts
    if edge_mean > 30:
        score += 15
        issues.append("High edge density — possible artifact from generation process")

    # Very low edge density in some areas but high in others
    w, h = edges.size
    quadrants = [
        edges.crop((0, 0, w // 2, h // 2)),
        edges.crop((w // 2, 0, w, h // 2)),
        edges.crop((0, h // 2, w // 2, h)),
        edges.crop((w // 2, h // 2, w, h)),
    ]

    q_edge_means = [ImageStat.Stat(q).mean[0] for q in quadrants]
    q_mean_avg = sum(q_edge_means) / 4
    q_variance = sum((m - q_mean_avg) ** 2 for m in q_edge_means) / 4

    if q_variance > 100:
        score += 30
        issues.append("Uneven edge distribution — potential blending boundary detected")
    elif q_variance > 40:
        score += 15
        issues.append("Moderate edge variation across regions")

    # Check for sharp unnatural boundaries using Laplacian-like filter
    sharp = gray.filter(ImageFilter.Kernel(
        size=(3, 3),
        kernel=[0, 1, 0, 1, -4, 1, 0, 1, 0],
        scale=1,
        offset=128,
    ))
    sharp_stat = ImageStat.Stat(sharp)
    if sharp_stat.stddev[0] > 40:
        score += 20
        issues.append("Sharp transition patterns detected — possible copy-paste boundaries")
    elif sharp_stat.stddev[0] > 25:
        score += 10
        issues.append("Some sharp transitions present")

    score = min(100, score)

    if not issues:
        detail = "Edge patterns appear natural with no splicing indicators"
        status = "ok"
    elif score < 40:
        detail = "; ".join(issues)
        status = "moderate"
    else:
        detail = "; ".join(issues)
        status = "warning"

    return {
        "name": "Edge & Boundary Analysis",
        "status": status,
        "score": score,
        "detail": detail,
    }
