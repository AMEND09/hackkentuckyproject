"""Detect new construction hazards on already-published routes.

`generate_plan` computes Route.safety_context.active_construction once, at
plan-generation time. Right-of-way permits are issued continuously, so a
route published last week can have new construction appear on it today. This
module re-queries the live geodata layer for each published route, diffs
against what was last stored, and raises a dispatcher-facing alert (and
refreshes safety_context) when something new shows up — the safe, reviewable
half of "reroute around construction": flag it for a human, don't silently
re-solve a live route.
"""

from __future__ import annotations

from django.utils import timezone

from apps.notifications.services import notify_roles
from apps.operations.models import OperationalAlert, Trip
from apps.operations.services.lifecycle import broadcast_event
from apps.routing.models import Route, RoutePlan


def _route_path_points(route: Route) -> list[tuple[float, float]]:
    return [(float(s.latitude), float(s.longitude)) for s in route.stops.order_by("sequence")]


def refresh_construction_hazards(route: Route, when=None) -> list[dict]:
    """Re-checks active construction for one route; returns newly-appeared permits.

    Always refreshes route.safety_context.active_construction to the current
    live data (even when nothing new appeared, e.g. a permit expired), so
    stale hazard data doesn't linger on a route that was generated weeks ago.
    """
    from apps.geodata import services as geo_services

    when = when or timezone.now()
    path_points = _route_path_points(route)
    if not path_points:
        return []
    fresh = geo_services.active_construction_near(path_points, when)
    ctx = dict(route.safety_context or {})
    known_permit_nos = {c.get("permit_no") for c in ctx.get("active_construction") or []}
    new_hits = [c for c in fresh if c.get("permit_no") not in known_permit_nos]
    if fresh != (ctx.get("active_construction") or []):
        ctx["active_construction"] = fresh
        route.safety_context = ctx
        route.save(update_fields=["safety_context"])
    return new_hits


def scan_published_routes(district=None) -> list[dict]:
    """Scans every published route (optionally scoped to one district), alerting on new hazards."""
    qs = Route.objects.filter(route_plan__status=RoutePlan.Status.PUBLISHED).select_related(
        "route_plan__district", "school"
    )
    if district is not None:
        qs = qs.filter(route_plan__district=district)

    when = timezone.now()
    today = timezone.localdate()
    created = []
    for route in qs:
        new_hits = refresh_construction_hazards(route, when=when)
        if not new_hits:
            continue
        district_obj = route.route_plan.district
        trip = Trip.objects.filter(route=route, service_date=today).first()
        first = new_hits[0]
        extra = f" (+{len(new_hits) - 1} more nearby)" if len(new_hits) > 1 else ""
        message = (
            f"A new right-of-way permit — {first.get('work_type') or 'construction'} near "
            f"{first.get('street_address') or 'this route'}{extra} — now overlaps {route.route_code}. "
            "Review whether the published route still holds up."
        )
        alert = OperationalAlert.objects.create(
            district=district_obj,
            trip=trip,
            alert_type="new_construction_hazard",
            title=f"New construction hazard on {route.route_code}",
            message=message,
            severity=OperationalAlert.Severity.WARNING,
        )
        notify_roles(
            district_obj,
            ["dispatcher", "planner", "district_admin"],
            alert.title,
            alert.message,
            "alert.created",
            {"alert_id": str(alert.id), "route_id": str(route.id)},
        )
        if trip:
            broadcast_event(trip, "alert.created", {"alert_id": str(alert.id), "title": alert.title})
        created.append({"route_id": str(route.id), "route_code": route.route_code, "alert_id": str(alert.id), "new_hits": new_hits})
    return created
