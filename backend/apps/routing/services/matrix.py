"""Travel-time matrix providers.

HaversineDemoProvider is the offline default. OSRMTableProvider pulls real
street-network durations/distances from any OSRM endpoint (public demo or
self-hosted) via the /table API and degrades per-cell to Haversine when OSRM
has no route. ExternalMapsProvider remains a documented placeholder.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import urllib.error
import urllib.request
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from apps.routing.models import TravelMatrixCache
from common.utilities.geo import haversine_km

logger = logging.getLogger(__name__)


class TravelMatrixProvider:
    name = "base"

    def matrix(self, points: list[tuple[float, float]], **kwargs) -> dict:
        raise NotImplementedError


class HaversineDemoProvider(TravelMatrixProvider):
    name = "haversine_demo"

    def __init__(self, road_multiplier: float = 1.38, urban_kmh: float = 28, suburban_kmh: float = 42):
        self.road_multiplier = road_multiplier
        self.urban_kmh = urban_kmh
        self.suburban_kmh = suburban_kmh

    def matrix(self, points: list[tuple[float, float]], departure_hour: int = 7, **kwargs) -> dict:
        n = len(points)
        distances = [[0.0] * n for _ in range(n)]
        durations = [[0] * n for _ in range(n)]
        rush = 1.18 if departure_hour in {7, 8, 15, 16} else 1.0
        for i, (lat1, lon1) in enumerate(points):
            for j, (lat2, lon2) in enumerate(points):
                if i == j:
                    continue
                km = haversine_km(lat1, lon1, lat2, lon2) * self.road_multiplier
                # Slight deterministic "road category" bump for longer hops
                category = "arterial" if km > 2.5 else "local"
                speed = self.suburban_kmh if km > 1.8 else self.urban_kmh
                if category == "local":
                    speed *= 0.9
                hours = km / max(speed, 8) * rush
                distances[i][j] = round(km, 3)
                durations[i][j] = max(30, int(hours * 3600))
        return {
            "provider": self.name,
            "distance_km": distances,
            "duration_s": durations,
            "p50_s": durations,
            "p90_s": [[int(v * 1.22) for v in row] for row in durations],
        }


class ExternalMapsProvider(TravelMatrixProvider):
    """Placeholder for a future paid routing API. Not used by default."""

    name = "external_maps"

    def matrix(self, points: list[tuple[float, float]], **kwargs) -> dict:
        raise RuntimeError(
            "ExternalMapsProvider is a stub. Configure a commercial routing API before enabling it."
        )


class OSRMTableProvider(TravelMatrixProvider):
    """Street-network durations/distances via the OSRM /table API.

    Falls back per-cell to Haversine when OSRM returns null (unroutable pair).
    Raises RuntimeError when the endpoint is unreachable so callers can
    degrade to HaversineDemoProvider.
    """

    name = "osrm_table"

    def __init__(self, base_url: str | None = None, timeout: int = 8, max_coords: int = 100):
        self.base_url = (base_url or getattr(settings, "OSRM_BASE_URL", "https://router.project-osrm.org")).rstrip("/")
        self.timeout = timeout
        self.max_coords = max_coords

    def matrix(self, points: list[tuple[float, float]], departure_hour: int = 7, **kwargs) -> dict:
        n = len(points)
        if n > self.max_coords:
            raise RuntimeError(f"OSRM table supports {self.max_coords} coordinates, got {n}.")
        coords = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in points)
        url = f"{self.base_url}/table/v1/driving/{coords}?annotations=duration,distance"
        req = urllib.request.Request(url, headers={"User-Agent": "RouteWise/1.0 (school-bus-poc)"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"OSRM table request failed: {exc}") from exc
        if data.get("code") != "Ok":
            raise RuntimeError(f"OSRM table returned {data.get('code')}.")
        durations = data.get("durations") or []
        distances = data.get("distances") or []
        fallback = HaversineDemoProvider()
        fh = fallback.matrix(points, departure_hour=departure_hour)
        out_dist = [[0.0] * n for _ in range(n)]
        out_dur = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                dur = (durations[i][j] if i < len(durations) and j < len(durations[i]) else None)
                dist_m = (distances[i][j] if i < len(distances) and j < len(distances[i]) else None)
                if dur is None:
                    out_dist[i][j] = fh["distance_km"][i][j]
                    out_dur[i][j] = fh["duration_s"][i][j]
                else:
                    out_dist[i][j] = round(float(dist_m or 0) / 1000, 3) if dist_m else fh["distance_km"][i][j]
                    out_dur[i][j] = max(30, int(float(dur)))
        return {
            "provider": self.name,
            "distance_km": out_dist,
            "duration_s": out_dur,
            "p50_s": out_dur,
            "p90_s": [[int(v * 1.22) for v in row] for row in out_dur],
        }


def default_matrix_provider() -> TravelMatrixProvider:
    """Street network when enabled, Haversine otherwise (offline-safe default)."""
    if getattr(settings, "USE_STREET_MATRIX", False):
        return OSRMTableProvider()
    return HaversineDemoProvider()


def street_matrix(district, points, departure_hour: int = 7) -> dict:
    """Cached matrix that prefers the street network and degrades to Haversine."""
    try:
        provider = default_matrix_provider()
        return cached_matrix(district, points, provider, departure_hour=departure_hour)
    except RuntimeError as exc:
        logger.warning("Street matrix unavailable (%s); using Haversine fallback.", exc)
        return cached_matrix(district, points, HaversineDemoProvider(), departure_hour=departure_hour)


def cached_matrix(district, points, provider: TravelMatrixProvider, departure_hour: int = 7) -> dict:
    raw = json.dumps({"pts": [[round(a, 5), round(b, 5)] for a, b in points], "h": departure_hour, "p": provider.name})
    key = hashlib.sha256(raw.encode()).hexdigest()[:40]
    hit = TravelMatrixCache.objects.filter(district=district, cache_key=key).first()
    if hit and (hit.expires_at is None or hit.expires_at > timezone.now()):
        return hit.payload
    payload = provider.matrix(points, departure_hour=departure_hour)
    TravelMatrixCache.objects.update_or_create(
        district=district,
        cache_key=key,
        defaults={"provider": provider.name, "payload": payload},
    )
    return payload
