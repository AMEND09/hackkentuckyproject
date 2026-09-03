"""Snap planned stops onto real streets.

Prefers Google Directions when GOOGLE_MAPS_API_KEY is set, otherwise OSRM.
The optimizer still uses Haversine between stops; this only builds the driver path.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.routing.models import TravelMatrixCache
from common.utilities.geo import bearing_degrees, haversine_km

logger = logging.getLogger(__name__)


def _osrm_base() -> str:
    return getattr(settings, "OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")


def _google_key() -> str:
    return (getattr(settings, "GOOGLE_MAPS_API_KEY", "") or "").strip()


def _stop_points(route) -> list[tuple[float, float]]:
    return [(float(s.latitude), float(s.longitude)) for s in route.stops.order_by("sequence")]


def _cache_key(points: list[tuple[float, float]]) -> str:
    provider = "google" if _google_key() else "osrm"
    raw = json.dumps({"p": provider, "pts": [[round(lat, 5), round(lng, 5)] for lat, lng in points]})
    return "street-drive-" + hashlib.sha256(raw.encode()).hexdigest()[:40]


def route_geometry(route, fetch: bool = True) -> dict:
    points = _stop_points(route)
    if len(points) < 2:
        return _straight(points)
    key = _cache_key(points)
    district = route.route_plan.district
    hit = TravelMatrixCache.objects.filter(district=district, cache_key=key).first()
    if hit and (hit.expires_at is None or hit.expires_at > timezone.now()) and (hit.payload or {}).get("coordinates"):
        return hit.payload
    if not fetch:
        return _straight(points)
    payload = fetch_street_drive(points)
    TravelMatrixCache.objects.update_or_create(
        district=district,
        cache_key=key,
        defaults={
            "provider": payload.get("provider") or "osrm",
            "payload": payload,
            "expires_at": timezone.now() + timedelta(days=7),
        },
    )
    return payload


def fetch_street_drive(points: list[tuple[float, float]]) -> dict:
    if _google_key():
        google = fetch_google_drive(points)
        if google.get("follows_streets"):
            return google
        logger.warning("Google Directions failed; falling back to OSRM.")
    return fetch_osrm_drive(points)


def decode_polyline(encoded: str) -> list[list[float]]:
    coords: list[list[float]] = []
    index = lat = lng = 0
    length = len(encoded or "")
    while index < length:
        for is_lat in (True, False):
            result = shift = 0
            while True:
                if index >= length:
                    return coords
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else (result >> 1)
            if is_lat:
                lat += delta
            else:
                lng += delta
        coords.append([lng / 1e5, lat / 1e5])
    return coords


def _strip_html(text: str) -> str:
    text = re.sub(r"<div[^>]*>", ". ", text or "")
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).replace(" .", ".").strip(" .")


def fetch_google_drive(points: list[tuple[float, float]]) -> dict:
    if len(points) < 2 or not _google_key():
        return _straight(points)
    params = {
        "origin": f"{points[0][0]},{points[0][1]}",
        "destination": f"{points[-1][0]},{points[-1][1]}",
        "mode": "driving",
        "units": "imperial",
        "key": _google_key(),
    }
    mids = points[1:-1][:23]
    if mids:
        params["waypoints"] = "|".join(f"{lat},{lng}" for lat, lng in mids)
    url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "RouteWise-hackathon/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("Google Directions request failed (%s).", exc)
        return _straight(points)
    if data.get("status") != "OK" or not data.get("routes"):
        logger.warning("Google Directions status %s: %s", data.get("status"), data.get("error_message"))
        return _straight(points)
    route = data["routes"][0]
    geometry = decode_polyline((route.get("overview_polyline") or {}).get("points") or "")
    if len(geometry) < 2:
        return _straight(points)
    steps = []
    dist_along = 0.0
    for leg in route.get("legs") or []:
        for step in leg.get("steps") or []:
            start = step.get("start_location") or {}
            dist = float((step.get("distance") or {}).get("value") or 0)
            instruction = _strip_html(step.get("html_instructions") or "Continue")
            steps.append(
                {
                    "instruction": instruction,
                    "street": instruction,
                    "type": step.get("maneuver") or "continue",
                    "modifier": "",
                    "distance_m": round(dist, 1),
                    "duration_s": round(float((step.get("duration") or {}).get("value") or 0), 1),
                    "location": [float(start.get("lng") or 0), float(start.get("lat") or 0)],
                    "along_m": round(dist_along, 1),
                }
            )
            dist_along += dist
    return {
        "provider": "google",
        "follows_streets": True,
        "coordinates": geometry,
        "steps": steps,
        "distance_m": round(dist_along, 1),
        "duration_s": round(
            sum(float((leg.get("duration") or {}).get("value") or 0) for leg in route.get("legs") or []),
            1,
        ),
    }


def fetch_osrm_drive(points: list[tuple[float, float]]) -> dict:
    """points are (lat, lng). Returns GeoJSON-style [lng, lat] coordinates plus turn steps."""
    if len(points) < 2:
        return _straight(points)
    coords = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in points)
    url = (
        f"{_osrm_base()}/route/v1/driving/{coords}"
        "?overview=full&geometries=geojson&steps=true&annotations=false&continue_straight=true"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "RouteWise-hackathon/1.0 (school-bus-poc)"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("OSRM street route failed (%s); falling back to straight lines.", exc)
        return _straight(points)
    if data.get("code") != "Ok" or not data.get("routes"):
        logger.warning("OSRM returned %s; falling back to straight lines.", data.get("code"))
        return _straight(points)
    route = data["routes"][0]
    geometry = (route.get("geometry") or {}).get("coordinates") or []
    if len(geometry) < 2:
        return _straight(points)
    steps = []
    dist_along = 0.0
    for leg in route.get("legs") or []:
        for step in leg.get("steps") or []:
            man = step.get("maneuver") or {}
            loc = man.get("location") or [0, 0]
            instruction = _instruction(man.get("type"), man.get("modifier"), step.get("name") or "")
            steps.append(
                {
                    "instruction": instruction,
                    "street": step.get("name") or "",
                    "type": man.get("type") or "",
                    "modifier": man.get("modifier") or "",
                    "distance_m": round(float(step.get("distance") or 0), 1),
                    "duration_s": round(float(step.get("duration") or 0), 1),
                    "location": [float(loc[0]), float(loc[1])],
                    "along_m": round(dist_along, 1),
                }
            )
            dist_along += float(step.get("distance") or 0)
    return {
        "provider": "osrm",
        "follows_streets": True,
        "coordinates": [[float(lng), float(lat)] for lng, lat in geometry],
        "steps": steps,
        "distance_m": round(float(route.get("distance") or 0), 1),
        "duration_s": round(float(route.get("duration") or 0), 1),
    }


def _straight(points: list[tuple[float, float]]) -> dict:
    coords = [[lng, lat] for lat, lng in points]
    return {
        "provider": "straight",
        "follows_streets": False,
        "coordinates": coords,
        "steps": [],
        "distance_m": 0,
        "duration_s": 0,
    }


def _instruction(kind: str | None, modifier: str | None, name: str) -> str:
    kind = (kind or "continue").replace("_", " ")
    modifier = (modifier or "").replace("_", " ")
    road = name.strip() or "the road"
    if kind == "arrive":
        return "Arrive at the next stop"
    if kind == "depart":
        heading = modifier or "straight"
        return f"Head {heading} on {road}"
    if kind == "turn":
        return f"Turn {modifier or 'ahead'} onto {road}"
    if kind in {"new name", "continue"}:
        return f"Continue on {road}"
    if kind == "merge":
        return f"Merge {modifier or 'ahead'} onto {road}"
    if kind in {"on ramp", "off ramp"}:
        return f"Take the ramp onto {road}"
    if kind == "fork":
        return f"Keep {modifier or 'ahead'} at the fork onto {road}"
    if kind == "end of road":
        return f"Turn {modifier or 'ahead'} onto {road}"
    if "roundabout" in kind or kind == "rotary":
        return f"Enter the roundabout and continue on {road}"
    if modifier:
        return f"{kind.title()} {modifier} onto {road}"
    return f"Continue on {road}"


def interpolate_along(coords: list[list[float]], t: float) -> tuple[float, float, float, float]:
    """Return (lat, lng, heading, meters_along) for t in [0, 1] along [lng,lat] coords."""
    t = min(1.0, max(0.0, float(t)))
    if len(coords) == 1:
        return coords[0][1], coords[0][0], 0.0, 0.0
    segs = []
    total = 0.0
    for i in range(len(coords) - 1):
        d = haversine_km(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000
        segs.append(max(d, 0.01))
        total += segs[-1]
    target = t * total
    acc = 0.0
    for i, d in enumerate(segs):
        if acc + d >= target:
            local = (target - acc) / d
            lng = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * local
            lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * local
            heading = bearing_degrees(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
            return lat, lng, heading, target
        acc += d
    lng, lat = coords[-1]
    heading = bearing_degrees(coords[-2][1], coords[-2][0], lat, lng) if len(coords) > 1 else 0.0
    return lat, lng, heading, total


def meters_along(coords: list[list[float]], lat: float, lng: float) -> float:
    best_d = 1e18
    best_m = 0.0
    acc = 0.0
    for i in range(len(coords) - 1):
        d0 = haversine_km(lat, lng, coords[i][1], coords[i][0]) * 1000
        if d0 < best_d:
            best_d = d0
            best_m = acc
        acc += haversine_km(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000
    return best_m


def next_step(geo: dict, meters: float) -> dict | None:
    steps = [s for s in (geo.get("steps") or []) if s.get("type") != "arrive"]
    upcoming = [s for s in steps if float(s.get("along_m") or 0) >= meters - 15]
    if upcoming:
        return upcoming[0]
    all_steps = geo.get("steps") or []
    return all_steps[-1] if all_steps else None


def upcoming_steps(geo: dict, meters: float, limit: int = 6) -> list[dict]:
    steps = [s for s in (geo.get("steps") or []) if s.get("type") != "arrive"]
    upcoming = [s for s in steps if float(s.get("along_m") or 0) >= meters - 15]
    return upcoming[:limit]


def passed_stop_sequence(route, meters: float, coords: list[list[float]]) -> int:
    stops = list(route.stops.order_by("sequence"))
    seq = stops[0].sequence if stops else 0
    acc = 0.0
    si = 1
    for i in range(len(coords) - 1):
        if si >= len(stops):
            break
        acc += haversine_km(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000
        slat, slng = float(stops[si].latitude), float(stops[si].longitude)
        if haversine_km(coords[i][1], coords[i][0], slat, slng) * 1000 < 90 and acc <= meters + 40:
            seq = stops[si].sequence
            si += 1
        if acc > meters:
            break
    return seq
