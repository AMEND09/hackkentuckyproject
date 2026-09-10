"""Quantile-regression travel models trained on synthetic data."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from django.utils import timezone

from apps.machine_learning.models import ModelArtifact

FEATURE_ORDER = [
    "distance_km",
    "planned_duration_s",
    "departure_hour",
    "day_of_week",
    "road_category",
    "traffic_severity",
    "rain",
    "weather_severity",
    "passenger_load",
    "students_boarding",
    "wheelchair_boardings",
    "remaining_stops",
    "urban_density",
    "historical_delay_s",
    "segment_position",
]


def artifact_dir() -> Path:
    path = Path(settings.MODEL_ARTIFACT_DIRECTORY)
    path.mkdir(parents=True, exist_ok=True)
    return path


# In-process cache of deserialized models keyed by (path, mtime), so live GPS
# pings don't pay a joblib load per request. Retrains write a new file path or
# mtime, which invalidates the single cached entry.
_MODEL_CACHE: dict = {}


def _load_joblib_cached(path_str: str):
    mtime = Path(path_str).stat().st_mtime
    key = (path_str, mtime)
    cached = _MODEL_CACHE.get(key)
    if cached is None:
        _MODEL_CACHE.clear()
        cached = joblib.load(path_str)
        _MODEL_CACHE[key] = cached
    return cached


def load_active_models():
    models = {}
    for mtype in (ModelArtifact.ModelType.P50_TRAVEL, ModelArtifact.ModelType.P90_TRAVEL):
        row = (
            ModelArtifact.objects.filter(model_type=mtype, is_active=True)
            .order_by("-trained_at")
            .first()
        )
        if row and Path(row.file_path).exists():
            models[mtype] = {"model": _load_joblib_cached(row.file_path), "row": row}
    clf = (
        ModelArtifact.objects.filter(model_type=ModelArtifact.ModelType.LATE_CLASSIFIER, is_active=True)
        .order_by("-trained_at")
        .first()
    )
    if clf and Path(clf.file_path).exists():
        models["late"] = {"model": _load_joblib_cached(clf.file_path), "row": clf}
    return models


# Training support per feature (see training.generate_synthetic_frame). Live
# values outside these ranges are clipped before inference so evening/weekend
# operations and large accumulated delays don't extrapolate the trees.
_CLIP_RANGES = {
    "departure_hour": (6, 17),
    "passenger_load": (0, 70),
    "students_boarding": (0, 18),
    "wheelchair_boardings": (0, 3),
    "remaining_stops": (0, 12),
    "urban_density": (0, 1),
    "traffic_severity": (0, 1),
    "weather_severity": (0, 1),
    "historical_delay_s": (0, 200),
    "segment_position": (0, 1),
}


def _clip_feature(key: str, value) -> float:
    num = float(value) if value is not None else 0.0
    bounds = _CLIP_RANGES.get(key)
    if bounds:
        num = min(bounds[1], max(bounds[0], num))
    return num


def _fallback_result(planned: float) -> dict:
    planned = float(planned or 60)
    return {
        "p50_s": planned,
        "p90_s": int(planned * 1.22),
        "uncertainty_s": int(planned * 0.22),
        "delay_risk": 0.15,
        "fallback": True,
        "synthetic": True,
    }


def predict_segments(feature_dicts: list[dict]) -> list[dict]:
    """Batch version of predict_segment: loads models once for many legs."""
    if not feature_dicts:
        return []
    loaded = load_active_models()
    if ModelArtifact.ModelType.P50_TRAVEL not in loaded:
        return [_fallback_result(f.get("planned_duration_s")) for f in feature_dicts]
    x = np.array(
        [[_clip_feature(key, f.get(key)) for key in FEATURE_ORDER] for f in feature_dicts],
        dtype=float,
    )
    pred50 = np.asarray(loaded[ModelArtifact.ModelType.P50_TRAVEL]["model"].predict(x), dtype=float)
    if ModelArtifact.ModelType.P90_TRAVEL in loaded:
        pred90 = np.asarray(loaded[ModelArtifact.ModelType.P90_TRAVEL]["model"].predict(x), dtype=float)
    else:
        pred90 = pred50 * 1.2
    if "late" in loaded:
        proba = np.asarray(loaded["late"]["model"].predict_proba(x))
        late = proba[:, 1] if proba.shape[1] > 1 else proba[:, 0]
    else:
        late = np.full(len(feature_dicts), 0.2)
    version = loaded[ModelArtifact.ModelType.P50_TRAVEL]["row"].version
    results = []
    for i, f in enumerate(feature_dicts):
        p50 = max(20, float(pred50[i]))
        p90 = max(p50, float(pred90[i]))
        results.append(
            {
                "p50_s": int(p50),
                "p90_s": int(p90),
                "uncertainty_s": int(max(0, p90 - p50)),
                "delay_risk": round(float(late[i]), 3),
                "fallback": False,
                "synthetic": True,
                "model_version": version,
            }
        )
    return results


def predict_segment(features: dict) -> dict:
    """Return P50/P90 seconds. Falls back to planned duration if models are missing."""
    loaded = load_active_models()
    if ModelArtifact.ModelType.P50_TRAVEL not in loaded:
        return _fallback_result(features.get("planned_duration_s"))
    return predict_segments([features])[0]


def _rush_factor(hour: int) -> float:
    return 0.45 if hour in {7, 8, 15, 16} else 0.2


def overlay_ml_matrix(matrix: dict, points, hour: int, mode: str, node_meta=None, day_of_week=None) -> dict:
    """Overlay model P50/P90 predictions onto a Haversine matrix.

    node_meta (optional) is aligned with points: [{boarding, wheelchair, load}].
    Without it, per-leg boarding falls back to neutral training-median values.
    Always returns p50_s/p90_s plus a delay_risk matrix from the late classifier
    (0.15 neutral risk when models are missing, matching predict fallbacks).
    """
    from django.utils import timezone

    n = len(points)
    if day_of_week is None:
        # Models only saw Mon-Fri (0-4); clamp weekend planning days.
        day_of_week = min(timezone.localdate().weekday(), 4)
    metas = list(node_meta) if node_meta else [{} for _ in points]
    feats = []
    coords = []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            dist = matrix["distance_km"][i][j]
            planned = matrix["duration_s"][i][j]
            dest = metas[j] if j < len(metas) else {}
            feats.append(
                {
                    "distance_km": dist,
                    "planned_duration_s": planned,
                    "departure_hour": hour,
                    "day_of_week": day_of_week,
                    "road_category": 1 if dist > 2.5 else 0,
                    "traffic_severity": _rush_factor(hour),
                    "rain": 0,
                    "weather_severity": 0.15,
                    "passenger_load": dest.get("load", 20),
                    "students_boarding": dest.get("boarding", 6),
                    "wheelchair_boardings": dest.get("wheelchair", 0),
                    "remaining_stops": max(0, n - 1 - j),
                    "urban_density": 0.6,
                    "historical_delay_s": 0,
                    "segment_position": j / max(n - 1, 1),
                }
            )
            coords.append((i, j))
    preds = predict_segments(feats)
    p50 = [row[:] for row in matrix["p50_s"]]
    p90 = [row[:] for row in matrix["p90_s"]]
    risk = [[0.0] * n for _ in range(n)]
    for (i, j), pred in zip(coords, preds):
        p50[i][j] = max(20, int(pred["p50_s"]))
        p90[i][j] = max(p50[i][j], int(pred["p90_s"]))
        risk[i][j] = pred["delay_risk"]
    out = dict(matrix)
    out["p50_s"] = p50
    out["p90_s"] = p90
    out["delay_risk"] = risk
    overlay_active = bool(preds) and not preds[0].get("fallback", True)
    out["ml_overlay"] = overlay_active
    out["ml_fallback"] = not overlay_active
    out["synthetic"] = True
    return out
