"""Spatial lookups over the Louisville open-data reference layers.

All datasets are small (hundreds to a few thousand rows), so we keep a
lazily-built, process-local grid index per model instead of adding a spatial
database extension for a hackathon-scale dataset. Buckets are ~0.01 degrees
(~1km) so a 3x3 neighborhood comfortably covers any realistic search radius
used here (tens to a few hundred meters).

Every lookup degrades to "nothing found" (None / [] / 0) when a table is
empty, so callers — the ML feature builders and the route optimizer — work
identically whether or not `import_louisville_open_data` has been run yet.
"""

from __future__ import annotations

from datetime import datetime

from common.utilities.geo import haversine_km

from apps.geodata.models import (
    ConstructionPermit,
    HighInjurySegment,
    MidblockCrossing,
    RoadSegment,
    SnowRoute,
    TrafficSignal,
)

BUCKET = 0.01  # ~1.1km lat / ~0.87km lng at Louisville's latitude

_INDEX_CACHE: dict[str, tuple[int, dict]] = {}


def _bucket(lat: float, lng: float) -> tuple[int, int]:
    return (round(lat / BUCKET), round(lng / BUCKET))


def _neighbors(lat: float, lng: float):
    by, bx = _bucket(lat, lng)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            yield (by + dy, bx + dx)


def _build_grid(model, rows) -> dict:
    grid: dict[tuple[int, int], list] = {}
    for row in rows:
        grid.setdefault(_bucket(row["lat"], row["lng"]), []).append(row)
    return grid


def _get_index(model, row_builder) -> dict:
    """Return a cached {bucket: [rows]} grid, rebuilt when the row count changes."""
    count = model.objects.count()
    cached = _INDEX_CACHE.get(model.__name__)
    if cached and cached[0] == count:
        return cached[1]
    grid = _build_grid(model, row_builder())
    _INDEX_CACHE[model.__name__] = (count, grid)
    return grid


def clear_cache() -> None:
    """Called by the import command after a bulk load so stale indices are dropped."""
    _INDEX_CACHE.clear()


def _signal_rows():
    return [
        {"lat": s.latitude, "lng": s.longitude, "id": s.id, "main_street": s.main_street, "cross_street": s.cross_street}
        for s in TrafficSignal.objects.all().only("id", "latitude", "longitude", "main_street", "cross_street")
    ]


def _crossing_rows():
    return [
        {"lat": c.latitude, "lng": c.longitude, "id": c.id, "has_rrfb_or_signal": c.has_rrfb_or_signal}
        for c in MidblockCrossing.objects.all().only("id", "latitude", "longitude", "has_rrfb_or_signal")
    ]


def _road_rows():
    return [
        {
            "lat": r.midpoint_lat,
            "lng": r.midpoint_lng,
            "id": r.id,
            "road_name": r.road_name,
            "core_class": r.core_class,
            "context_class": r.context_class,
            "road_category": r.road_category,
            "urban_density": r.urban_density,
            "speed_limit_mph": r.speed_limit_mph,
        }
        for r in RoadSegment.objects.all()
    ]


def _high_injury_rows():
    return [
        {
            "lat": h.midpoint_lat,
            "lng": h.midpoint_lng,
            "id": h.id,
            "road_name": h.road_name,
            "corridor_name": h.corridor_name,
            "priority_rank": h.priority_rank,
            "length_miles": h.length_miles,
        }
        for h in HighInjurySegment.objects.all()
    ]


def _snow_rows():
    return [
        {"lat": s.midpoint_lat, "lng": s.midpoint_lng, "id": s.id, "priority": s.priority, "response": s.response}
        for s in SnowRoute.objects.all()
    ]


def _nearest(grid: dict, lat: float, lng: float, radius_m: float):
    """Return (row, distance_m) for the closest row within radius, else (None, None)."""
    best_row, best_d = None, None
    for bucket in _neighbors(lat, lng):
        for row in grid.get(bucket, ()):
            d = haversine_km(lat, lng, row["lat"], row["lng"]) * 1000
            if d <= radius_m and (best_d is None or d < best_d):
                best_row, best_d = row, d
    return best_row, best_d


def _all_within(grid: dict, lat: float, lng: float, radius_m: float) -> list:
    out = []
    for bucket in _neighbors(lat, lng):
        for row in grid.get(bucket, ()):
            d = haversine_km(lat, lng, row["lat"], row["lng"]) * 1000
            if d <= radius_m:
                out.append((row, d))
    return out


def road_context_for(lat: float, lng: float, radius_m: float = 120.0) -> dict | None:
    """Nearest classified road segment: road_category (0/1/2) + urban_density (0-1)."""
    grid = _get_index(RoadSegment, _road_rows)
    row, _ = _nearest(grid, lat, lng, radius_m)
    return row


def signal_count_near(lat: float, lng: float, radius_m: float = 220.0) -> int:
    grid = _get_index(TrafficSignal, _signal_rows)
    return len(_all_within(grid, lat, lng, radius_m))


def midblock_crossing_near(lat: float, lng: float, radius_m: float = 90.0) -> bool:
    grid = _get_index(MidblockCrossing, _crossing_rows)
    row, _ = _nearest(grid, lat, lng, radius_m)
    return row is not None


def stop_safety_flags(lat: float, lng: float) -> dict:
    """Computed safety context for a proposed/existing bus stop location.

    Called from apps.transportation.models.BusStop.save(), so every stop —
    created via the API or via CSV import commit — gets this for free.
    Degrades to all-False/None when the geodata tables are empty.
    """
    grid_hi = _get_index(HighInjurySegment, _high_injury_rows)
    near_hi, _ = _nearest(grid_hi, lat, lng, 60.0)
    has_crossing = midblock_crossing_near(lat, lng, radius_m=90.0)
    has_signal = signal_count_near(lat, lng, radius_m=60.0) > 0
    return {
        "on_high_injury_corridor": bool(near_hi),
        "high_injury_corridor_name": (near_hi or {}).get("corridor_name") or (near_hi or {}).get("road_name") if near_hi else None,
        "has_marked_crossing_or_signal": bool(has_crossing or has_signal),
    }


def midpoint(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def high_injury_overlap(path_points: list[tuple[float, float]], radius_m: float = 45.0) -> dict:
    """Approximate how much of a stop-to-stop path rides along a Vision Zero high-injury corridor.

    path_points are (lat, lng) in visiting order (e.g. depot -> stops -> school).
    Each leg counts toward the overlap if either endpoint or its midpoint falls
    within `radius_m` of a mapped high-injury segment's representative point.
    """
    grid = _get_index(HighInjurySegment, _high_injury_rows)
    if not grid or len(path_points) < 2:
        return {"km": 0.0, "corridors": [], "worst_priority": None}
    total_km = 0.0
    corridors: dict[str, float] = {}
    worst_priority = None
    for a, b in zip(path_points, path_points[1:]):
        leg_km = haversine_km(a[0], a[1], b[0], b[1])
        mid = midpoint(a, b)
        hits = []
        for pt in (a, mid, b):
            row, _ = _nearest(grid, pt[0], pt[1], radius_m)
            if row:
                hits.append(row)
        if hits:
            total_km += leg_km
            for row in hits:
                name = row["corridor_name"] or row["road_name"] or "Unnamed corridor"
                corridors[name] = max(corridors.get(name, 0.0), leg_km)
                pr = row.get("priority_rank")
                if pr is not None and (worst_priority is None or pr < worst_priority):
                    worst_priority = pr
    return {
        "km": round(total_km, 2),
        "corridors": sorted(corridors, key=corridors.get, reverse=True)[:5],
        "worst_priority": worst_priority,
    }


def snow_route_coverage(path_points: list[tuple[float, float]], radius_m: float = 70.0) -> float:
    """Fraction of path legs that ride on a mapped priority snow route (0..1)."""
    grid = _get_index(SnowRoute, _snow_rows)
    if not grid or len(path_points) < 2:
        return 1.0  # no data loaded: don't manufacture a winter-risk signal
    covered, total = 0, 0
    for a, b in zip(path_points, path_points[1:]):
        total += 1
        mid = midpoint(a, b)
        row, _ = _nearest(grid, mid[0], mid[1], radius_m)
        if row:
            covered += 1
    return round(covered / total, 3) if total else 1.0


def active_construction_near(
    path_points: list[tuple[float, float]], when: datetime, radius_m: float = 110.0
) -> list[dict]:
    """Active ROW construction permits within radius_m of any path point, active on `when`."""
    if not path_points:
        return []
    qs = ConstructionPermit.objects.filter(
        source=ConstructionPermit.Source.CURRENT,
        latitude__isnull=False,
        longitude__isnull=False,
    )
    candidates = list(qs)
    hits: dict[str, dict] = {}
    for permit in candidates:
        if not permit.is_active_on(when):
            continue
        for lat, lng in path_points:
            d = haversine_km(lat, lng, permit.latitude, permit.longitude) * 1000
            if d <= radius_m:
                hits[str(permit.id)] = {
                    "permit_no": permit.permit_no,
                    "work_type": permit.work_type,
                    "street_address": permit.street_address,
                    "to_date": permit.to_date.isoformat() if permit.to_date else None,
                }
                break
    return list(hits.values())[:10]
