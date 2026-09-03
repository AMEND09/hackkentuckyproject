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


def load_active_models():
    models = {}
    for mtype in (ModelArtifact.ModelType.P50_TRAVEL, ModelArtifact.ModelType.P90_TRAVEL):
        row = (
            ModelArtifact.objects.filter(model_type=mtype, is_active=True)
            .order_by("-trained_at")
            .first()
        )
        if row and Path(row.file_path).exists():
            models[mtype] = {"model": joblib.load(row.file_path), "row": row}
    clf = (
        ModelArtifact.objects.filter(model_type=ModelArtifact.ModelType.LATE_CLASSIFIER, is_active=True)
        .order_by("-trained_at")
        .first()
    )
    if clf and Path(clf.file_path).exists():
        models["late"] = {"model": joblib.load(clf.file_path), "row": clf}
    return models


def _vector(features: dict) -> np.ndarray:
    vals = []
    for key in FEATURE_ORDER:
        val = features.get(key, 0)
        vals.append(float(val) if val is not None else 0.0)
    return np.array(vals, dtype=float).reshape(1, -1)


def predict_segment(features: dict) -> dict:
    """Return P50/P90 seconds. Falls back to planned duration if models are missing."""
    planned = float(features.get("planned_duration_s") or 60)
    loaded = load_active_models()
    if ModelArtifact.ModelType.P50_TRAVEL not in loaded:
        return {
            "p50_s": planned,
            "p90_s": int(planned * 1.22),
            "uncertainty_s": int(planned * 0.22),
            "delay_risk": 0.15,
            "fallback": True,
            "synthetic": True,
        }
    x = _vector(features)
    p50 = float(loaded[ModelArtifact.ModelType.P50_TRAVEL]["model"].predict(x)[0])
    p90 = float(loaded[ModelArtifact.ModelType.P90_TRAVEL]["model"].predict(x)[0]) if ModelArtifact.ModelType.P90_TRAVEL in loaded else p50 * 1.2
    p50, p90 = max(20, p50), max(p50, p90)
    late = 0.2
    if "late" in loaded:
        proba = loaded["late"]["model"].predict_proba(x)[0]
        late = float(proba[1] if len(proba) > 1 else proba[0])
    return {
        "p50_s": int(p50),
        "p90_s": int(p90),
        "uncertainty_s": int(max(0, p90 - p50)),
        "delay_risk": round(late, 3),
        "fallback": False,
        "synthetic": True,
    }


def overlay_ml_matrix(matrix: dict, points, hour: int, mode: str) -> dict:
    loaded = load_active_models()
    if ModelArtifact.ModelType.P50_TRAVEL not in loaded:
        matrix = dict(matrix)
        matrix["ml_overlay"] = False
        matrix["ml_fallback"] = True
        return matrix
    n = len(points)
    rows = []
    coords = []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            dist = matrix["distance_km"][i][j]
            planned = matrix["duration_s"][i][j]
            rows.append(
                [
                    dist,
                    planned,
                    hour,
                    2,
                    1 if dist > 2.5 else 0,
                    0.45 if hour in {7, 8} else 0.2,
                    0,
                    0.15,
                    20,
                    6,
                    0,
                    max(0, n - j),
                    0.6,
                    0,
                    j / max(n - 1, 1),
                ]
            )
            coords.append((i, j))
    x = np.array(rows, dtype=float)
    pred50 = loaded[ModelArtifact.ModelType.P50_TRAVEL]["model"].predict(x)
    pred90 = (
        loaded[ModelArtifact.ModelType.P90_TRAVEL]["model"].predict(x)
        if ModelArtifact.ModelType.P90_TRAVEL in loaded
        else pred50 * 1.2
    )
    p50 = [row[:] for row in matrix["p50_s"]]
    p90 = [row[:] for row in matrix["p90_s"]]
    for (i, j), a, b in zip(coords, pred50, pred90):
        p50[i][j] = max(20, int(a))
        p90[i][j] = max(p50[i][j], int(b))
    out = dict(matrix)
    out["p50_s"] = p50
    out["p90_s"] = p90
    out["ml_overlay"] = True
    out["ml_fallback"] = False
    out["synthetic"] = True
    return out
