"""Travel-time matrix providers.

HaversineDemoProvider is used in the POC. ExternalMapsProvider is a documented
adapter placeholder and is never required at runtime.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime

from django.utils import timezone

from apps.routing.models import TravelMatrixCache
from common.utilities.geo import haversine_km


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
