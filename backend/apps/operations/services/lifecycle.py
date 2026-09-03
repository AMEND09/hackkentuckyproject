from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone

from apps.operations.models import GPSPosition, OperationalAlert, Trip
from apps.routing.models import RoutePlan


def materialize_trips_for_plan(plan: RoutePlan, service_date=None) -> list[Trip]:
    service_date = service_date or timezone.localdate()
    created = []
    for route in plan.routes.select_related("assigned_driver", "assigned_vehicle"):
        trip, was = Trip.objects.get_or_create(
            district=plan.district,
            route=route,
            service_date=service_date,
            defaults={
                "driver": route.assigned_driver,
                "vehicle": route.assigned_vehicle,
                "status": Trip.Status.SCHEDULED,
            },
        )
        created.append(trip)
    return created


def _combine(service_date, t):
    if t is None:
        return None
    return timezone.make_aware(datetime.combine(service_date, t))


def refresh_trip_eta(trip: Trip, extra_delay_s: int = 0) -> Trip:
    trip.current_delay_seconds = max(0, trip.current_delay_seconds + extra_delay_s)
    remaining = max(1, (trip.route.p50_duration_seconds or 600) - trip.current_stop_sequence * 180)
    now = timezone.now()
    trip.current_p50_eta = now + timedelta(seconds=remaining + trip.current_delay_seconds)
    trip.current_p90_eta = now + timedelta(
        seconds=int(remaining * 1.2) + int(trip.current_delay_seconds * 1.15)
    )
    # Late probability from delay vs remaining slack
    slack = 8 * 60
    trip.late_probability = round(min(0.99, trip.current_delay_seconds / max(slack, 1) * 0.55 + 0.05), 3)
    if trip.current_delay_seconds > 4 * 60:
        trip.ml_explanation = (
            "Synthetic delay model: this bus is behind the planned P50 pace. "
            "Remaining stops and dwell time make a late school arrival more likely."
        )
    else:
        trip.ml_explanation = "The bus is near its planned pace. Remaining risk is mainly boarding variation."
    trip.save()
    maybe_raise_delay_alert(trip)
    return trip


def maybe_raise_delay_alert(trip: Trip) -> OperationalAlert | None:
    if trip.late_probability < 0.45 or trip.current_delay_seconds < 180:
        return None
    existing = trip.alerts.filter(alert_type="predicted_delay", is_acknowledged=False).first()
    if existing:
        existing.probability = trip.late_probability
        existing.message = (
            f"{trip.route.route_code} is {trip.current_delay_seconds // 60} min behind. "
            f"Late probability {trip.late_probability:.0%} (synthetic model)."
        )
        existing.save()
        broadcast_event(trip, "alert.created", {"alert_id": str(existing.id)})
        return existing
    alert = OperationalAlert.objects.create(
        district=trip.district,
        trip=trip,
        alert_type="predicted_delay",
        title=f"Predicted delay on {trip.route.route_code}",
        message=(
            f"Bus {trip.vehicle.internal_number if trip.vehicle else ''} is "
            f"{trip.current_delay_seconds // 60} minutes behind schedule. "
            f"P90 school ETA may miss the bell. Synthetic ML — not a production prediction."
        ),
        severity=OperationalAlert.Severity.WARNING if trip.late_probability < 0.7 else OperationalAlert.Severity.CRITICAL,
        probability=trip.late_probability,
    )
    from apps.notifications.services import notify_roles

    notify_roles(
        trip.district,
        ["dispatcher", "district_admin"],
        "Predicted delay",
        alert.message,
        "alert.created",
        {"alert_id": str(alert.id), "trip_id": str(trip.id)},
    )
    guardians_for_trip(trip, alert)
    broadcast_event(trip, "alert.created", {"alert_id": str(alert.id), "title": alert.title})
    return alert


def guardians_for_trip(trip: Trip, alert: OperationalAlert):
    from apps.accounts.models import GuardianStudentLink, UserRole
    from apps.notifications.models import Notification
    from apps.routing.models import RouteStopStudent

    student_ids = RouteStopStudent.objects.filter(route_stop__route=trip.route).values_list("student_id", flat=True)
    links = GuardianStudentLink.objects.filter(student_id__in=student_ids, is_verified=True).select_related("guardian")
    for link in links:
        prefs = link.notification_preferences or {}
        if prefs.get("delay", True) is False:
            continue
        Notification.objects.create(
            district=trip.district,
            user=link.guardian,
            title="Bus running behind",
            body="Your child's bus is running behind the scheduled pickup. This is a synthetic demo alert.",
            event_type="alert.created",
            payload={"trip_id": str(trip.id), "student_id": str(link.student_id)},
        )


def ingest_gps(trip: Trip, lat, lng, heading=0, speed=0, accuracy=8, is_simulated=False, timestamp=None) -> GPSPosition:
    pos = GPSPosition.objects.create(
        trip=trip,
        timestamp=timestamp or timezone.now(),
        latitude=lat,
        longitude=lng,
        heading=heading,
        speed_kmh=speed,
        accuracy_m=accuracy,
        is_simulated=is_simulated,
    )
    trip.is_simulated = trip.is_simulated or is_simulated
    # Crude delay: if simulated speed is low, add delay
    extra = 15 if is_simulated and speed < 8 else 8 if is_simulated else 0
    refresh_trip_eta(trip, extra_delay_s=extra)
    broadcast_event(
        trip,
        "trip.position.updated",
        {
            "latitude": float(lat),
            "longitude": float(lng),
            "is_simulated": is_simulated,
            "delay_seconds": trip.current_delay_seconds,
            "late_probability": trip.late_probability,
            "p50_eta": trip.current_p50_eta.isoformat() if trip.current_p50_eta else None,
            "p90_eta": trip.current_p90_eta.isoformat() if trip.current_p90_eta else None,
        },
    )
    broadcast_event(trip, "trip.eta.updated", {"late_probability": trip.late_probability})
    return pos


def broadcast_event(trip: Trip, event: str, payload: dict):
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if layer is None:
            return
        body = {"event": event, "trip_id": str(trip.id), "payload": payload}
        async_to_sync(layer.group_send)(f"trip_{trip.id}", {"type": "ops.message", "body": body})
        async_to_sync(layer.group_send)(
            f"district_{trip.district_id}", {"type": "ops.message", "body": body}
        )
    except Exception:
        # Polling fallback remains available
        pass


def interpolate(a: tuple[float, float], b: tuple[float, float], t: float) -> tuple[float, float]:
    t = min(1.0, max(0.0, t))
    return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
