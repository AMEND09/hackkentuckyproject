"""Live weather features for the travel-time models.

The `rain` / `weather_severity` features have always existed in FEATURE_ORDER
but were hardcoded to 0 / 0.15 everywhere they were built. Open-Meteo's
forecast API is free and keyless, so there's no reason to keep faking it: when
USE_LIVE_WEATHER is on we fetch real precipitation/snow for the district's
coordinates and cache it briefly; otherwise (default, and always in tests) we
return the same neutral fallback the rest of the codebase already used, so
behavior is unchanged unless a deployment opts in.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

_NEUTRAL = {"rain": 0, "weather_severity": 0.15, "source": "neutral_default"}

_CACHE_SECONDS = 900  # 15 minutes: forecasts don't need to be fresher than that


def _enabled() -> bool:
    return bool(getattr(settings, "USE_LIVE_WEATHER", False))


def current_conditions(lat: float, lng: float) -> dict:
    """Returns {"rain": 0/1, "weather_severity": 0..1, "source": ...}. Never raises."""
    if not _enabled():
        return dict(_NEUTRAL)
    cache_key = f"weather:{round(lat, 2)}:{round(lng, 2)}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    result = _fetch_open_meteo(lat, lng)
    cache.set(cache_key, result, _CACHE_SECONDS)
    return result


def _fetch_open_meteo(lat: float, lng: float) -> dict:
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lng, 4),
        "current": "precipitation,rain,showers,snowfall,weather_code,wind_speed_10m",
        "temperature_unit": "fahrenheit",
        "timezone": "America/New_York",
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "RouteWise-hackathon/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        logger.warning("Open-Meteo request failed (%s); using neutral weather.", exc)
        return dict(_NEUTRAL)
    current = data.get("current") or {}
    precip = float(current.get("precipitation") or 0)
    rain_mm = float(current.get("rain") or 0) + float(current.get("showers") or 0)
    snow_cm = float(current.get("snowfall") or 0)
    wind_kmh = float(current.get("wind_speed_10m") or 0)
    is_raining = rain_mm > 0.1 or precip > 0.1
    # Severity blends precipitation intensity, snow (weighted heavier — snow
    # affects school-bus speeds far more than light rain), and wind.
    severity = min(1.0, (precip / 6.0) + (snow_cm / 2.0) + max(0.0, (wind_kmh - 15) / 60))
    return {
        "rain": 1 if is_raining else 0,
        "weather_severity": round(severity, 3),
        "snow_cm": snow_cm,
        "source": "open_meteo",
    }
