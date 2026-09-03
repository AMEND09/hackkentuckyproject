from __future__ import annotations

from apps.routing.services.street_router import meters_along, next_step, route_geometry, upcoming_steps
from common.utilities.geo import bearing_degrees, cardinal_from_bearing, haversine_km


def trip_guidance(trip, lat=None, lng=None, heading=None) -> dict:
    """Next-turn guidance along a street-snapped path (OSRM). Not certified navigation."""
    stops = list(trip.route.stops.order_by("sequence"))
    pos = trip.positions.order_by("-timestamp").first()
    if lat is None and pos:
        lat = float(pos.latitude)
        lng = float(pos.longitude)
        if heading is None:
            heading = float(pos.heading or 0)
    geo = route_geometry(trip.route, fetch=True)
    coords = geo.get("coordinates") or []
    seq = trip.current_stop_sequence or 0
    upcoming = [s for s in stops if s.kind != "depot" and s.sequence > seq]
    if not upcoming:
        upcoming = [s for s in stops if s.kind == "school"] or stops[-1:]
    nxt = upcoming[0] if upcoming else None
    along = meters_along(coords, lat, lng) if lat is not None and lng is not None and coords else 0.0
    step = next_step(geo, along) if geo.get("follows_streets") else None
    remaining_km = 0.0
    if lat is not None and lng is not None and nxt:
        remaining_km = haversine_km(lat, lng, nxt.latitude, nxt.longitude)
        for a, b in zip(upcoming, upcoming[1:]):
            remaining_km += haversine_km(a.latitude, a.longitude, b.latitude, b.longitude)
    if heading is None and lat is not None and lng is not None and nxt:
        heading = bearing_degrees(lat, lng, nxt.latitude, nxt.longitude)
    heading = float(heading or 0)
    cardinal = cardinal_from_bearing(heading)
    to_next_km = (
        haversine_km(lat, lng, nxt.latitude, nxt.longitude) if lat is not None and lng is not None and nxt else 0.0
    )
    if step:
        to_next_km = max(to_next_km, float(step.get("distance_m") or 0) / 1000.0)
    minutes = max(1, round((to_next_km / 28.0) * 60)) if to_next_km else 0
    if nxt and nxt.kind == "school" and len(upcoming) <= 1 and (step or {}).get("type") == "arrive":
        instruction = f"Arrive at {nxt.name}"
    elif step:
        instruction = step["instruction"]
    elif nxt:
        instruction = f"Head {cardinal} toward {nxt.name}"
    else:
        instruction = "Waiting for route path"
    turns = []
    for s in upcoming_steps(geo, along, limit=6):
        turns.append(
            {
                "instruction": s.get("instruction"),
                "street": s.get("street"),
                "distance_m": s.get("distance_m"),
            }
        )
    return {
        "instruction": instruction,
        "then": turns[1]["instruction"] if len(turns) > 1 else (f"Toward {nxt.name}" if nxt else ""),
        "cardinal": cardinal,
        "heading": round(heading, 1),
        "next_stop_id": str(nxt.id) if nxt else None,
        "next_stop_name": nxt.name if nxt else None,
        "next_stop_kind": nxt.kind if nxt else None,
        "next_stop_sequence": nxt.sequence if nxt else None,
        "distance_to_next_km": round(to_next_km, 3),
        "remaining_km": round(remaining_km, 3),
        "eta_minutes": minutes,
        "remaining_stops": len(upcoming),
        "follows_streets": bool(geo.get("follows_streets")),
        "provider": geo.get("provider") or "straight",
        "upcoming_turns": turns,
        "disclaimer": (
            "Street path from Google Directions. Not certified school-bus navigation."
            if geo.get("provider") == "google"
            else "Street path from OpenStreetMap/OSRM. Not certified school-bus navigation."
            if geo.get("follows_streets")
            else "Street router unavailable — showing straight lines between stops."
        ),
    }
