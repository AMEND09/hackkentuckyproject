"""Synthetic travel-time data + sklearn quantile models."""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from django.utils import timezone
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from apps.machine_learning.models import ModelArtifact
from apps.machine_learning.services.predict import FEATURE_ORDER, artifact_dir

SEED = 42
N_ROWS = 22000


def generate_synthetic_frame(n: int = N_ROWS, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    distance = rng.uniform(0.2, 12.0, n)
    planned = distance / rng.uniform(6, 14, n) * 3600  # naive planned seconds
    hour = rng.choice(np.arange(6, 18), n)
    dow = rng.integers(0, 5, n)
    road = rng.integers(0, 3, n)  # 0 local, 1 arterial, 2 highway
    traffic = rng.beta(2, 5, n)
    rain = rng.binomial(1, 0.22, n)
    weather = np.clip(rain * rng.uniform(0.4, 1.0, n) + rng.beta(1.5, 5, n) * 0.3, 0, 1)
    load = rng.integers(0, 70, n)
    boarding = rng.integers(0, 18, n)
    wc = rng.integers(0, 3, n)
    remaining = rng.integers(0, 12, n)
    urban = rng.beta(3, 2, n)
    hist_delay = rng.gamma(1.5, 25, n)
    pos = rng.uniform(0, 1, n)

    rush = ((hour == 7) | (hour == 8) | (hour == 15) | (hour == 16)).astype(float)
    # Nonlinear actual duration
    actual = planned * (
        1.0
        + 0.22 * rush
        + 0.35 * traffic
        + 0.18 * rain
        + 0.12 * weather
        + 0.08 * (road == 0)
        + 0.04 * urban * traffic
        + 0.015 * (distance > 6) * traffic
        + 0.002 * hist_delay
    )
    dwell = boarding * 18 + wc * 85
    actual = actual + dwell + rng.normal(0, 18 + 40 * traffic + 25 * rain + 20 * urban, n)
    actual = np.clip(actual, 25, None)
    late = ((actual > planned * 1.15 + 40) | ((rush == 1) & (rain == 1) & (traffic > 0.5))).astype(int)

    data = {
        "distance_km": distance,
        "planned_duration_s": planned,
        "departure_hour": hour,
        "day_of_week": dow,
        "road_category": road,
        "traffic_severity": traffic,
        "rain": rain,
        "weather_severity": weather,
        "passenger_load": load,
        "students_boarding": boarding,
        "wheelchair_boardings": wc,
        "remaining_stops": remaining,
        "urban_density": urban,
        "historical_delay_s": hist_delay,
        "segment_position": pos,
        "actual_duration_s": actual,
        "late": late,
    }
    return pd.DataFrame(data)


def write_synthetic_csv() -> Path:
    df = generate_synthetic_frame()
    path = artifact_dir() / "synthetic_travel_segments.csv"
    df.to_csv(path, index=False)
    return path


def _xy(df: pd.DataFrame):
    return df[FEATURE_ORDER].values, df["actual_duration_s"].values, df["late"].values


def train_models() -> dict:
    csv_path = artifact_dir() / "synthetic_travel_segments.csv"
    if not csv_path.exists():
        write_synthetic_csv()
    df = pd.read_csv(csv_path)
    x, y, late = _xy(df)
    x_train, x_test, y_train, y_test, late_train, late_test = train_test_split(
        x, y, late, test_size=0.2, random_state=SEED
    )
    p50 = GradientBoostingRegressor(loss="quantile", alpha=0.50, n_estimators=200, random_state=SEED)
    p90 = GradientBoostingRegressor(loss="quantile", alpha=0.90, n_estimators=200, random_state=SEED)
    clf = GradientBoostingClassifier(n_estimators=120, random_state=SEED)
    p50.fit(x_train, y_train)
    p90.fit(x_train, y_train)
    clf.fit(x_train, late_train)

    pred50 = p50.predict(x_test)
    pred90 = p90.predict(x_test)
    baseline = x_test[:, FEATURE_ORDER.index("planned_duration_s")]
    mae = mean_absolute_error(y_test, pred50)
    base_mae = mean_absolute_error(y_test, baseline)
    rmse = mean_squared_error(y_test, pred50) ** 0.5
    coverage = float(np.mean(y_test <= pred90))
    late_pred = clf.predict(x_test)
    late_proba = clf.predict_proba(x_test)[:, 1]
    metrics = {
        "p50_mae": round(float(mae), 2),
        "p90_coverage": round(coverage, 3),
        "baseline_mae": round(float(base_mae), 2),
        "improvement_over_baseline": round(float((base_mae - mae) / max(base_mae, 1e-6)), 3),
        "rmse": round(float(rmse), 2),
        "classifier_precision": round(float(precision_score(late_test, late_pred, zero_division=0)), 3),
        "classifier_recall": round(float(recall_score(late_test, late_pred, zero_division=0)), 3),
        "classifier_f1": round(float(f1_score(late_test, late_pred, zero_division=0)), 3),
        "classifier_roc_auc": round(float(roc_auc_score(late_test, late_proba)), 3),
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
        "synthetic": True,
        "disclaimer": "Trained only on fictional seeded segments. Not real operations data.",
    }

    ModelArtifact.objects.filter(is_active=True).update(is_active=False)
    saved = {}
    now = timezone.now()
    for kind, est, extra in (
        (ModelArtifact.ModelType.P50_TRAVEL, p50, {"alpha": 0.5}),
        (ModelArtifact.ModelType.P90_TRAVEL, p90, {"alpha": 0.9}),
        (ModelArtifact.ModelType.LATE_CLASSIFIER, clf, {}),
    ):
        path = artifact_dir() / f"{kind}.joblib"
        joblib.dump(est, path)
        row = ModelArtifact.objects.create(
            district=None,
            model_type=kind,
            version=now.strftime("%Y%m%d%H%M"),
            file_path=str(path),
            feature_schema=FEATURE_ORDER,
            metrics={**metrics, **extra},
            is_active=True,
            is_synthetic=True,
            trained_at=now,
        )
        saved[kind] = str(row.id)
    import json

    (artifact_dir() / "metrics.json").write_text(json.dumps(metrics, indent=2))
    return {"metrics": metrics, "artifacts": saved}


def evaluate_models() -> dict:
    csv_path = artifact_dir() / "synthetic_travel_segments.csv"
    df = pd.read_csv(csv_path)
    x, y, late = _xy(df)
    _, x_test, _, y_test, _, late_test = train_test_split(x, y, late, test_size=0.2, random_state=SEED)
    from apps.machine_learning.services.predict import load_active_models

    loaded = load_active_models()
    if ModelArtifact.ModelType.P50_TRAVEL not in loaded:
        return {"error": "No trained models. Run train_travel_models."}
    pred50 = loaded[ModelArtifact.ModelType.P50_TRAVEL]["model"].predict(x_test)
    pred90 = loaded[ModelArtifact.ModelType.P90_TRAVEL]["model"].predict(x_test)
    baseline = x_test[:, FEATURE_ORDER.index("planned_duration_s")]
    clf = loaded["late"]["model"]
    late_pred = clf.predict(x_test)
    late_proba = clf.predict_proba(x_test)[:, 1]
    return {
        "p50_mae": float(mean_absolute_error(y_test, pred50)),
        "p90_coverage": float(np.mean(y_test <= pred90)),
        "baseline_mae": float(mean_absolute_error(y_test, baseline)),
        "rmse": float(mean_squared_error(y_test, pred50) ** 0.5),
        "classifier_precision": float(precision_score(late_test, late_pred, zero_division=0)),
        "classifier_recall": float(recall_score(late_test, late_pred, zero_division=0)),
        "classifier_f1": float(f1_score(late_test, late_pred, zero_division=0)),
        "classifier_roc_auc": float(roc_auc_score(late_test, late_proba)),
        "synthetic": True,
    }
