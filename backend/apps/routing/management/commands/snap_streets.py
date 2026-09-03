from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.operations.models import GPSPosition, Trip
from apps.routing.models import Route
from apps.routing.services.street_router import interpolate_along, passed_stop_sequence, route_geometry


class Command(BaseCommand):
    help = "Snap published routes to streets (OSRM, or Google if a key is set) and move live buses onto that path."

    def handle(self, *args, **options):
        routes = Route.objects.filter(route_plan__status="published").select_related("route_plan")
        n = 0
        for route in routes:
            geo = route_geometry(route, fetch=True)
            pts = len(geo.get("coordinates") or [])
            self.stdout.write(
                f"{route.route_code}: {geo.get('provider')} · {pts} path points · streets={geo.get('follows_streets')}"
            )
            n += 1
        active = Trip.objects.filter(status=Trip.Status.ACTIVE).select_related("route")
        for i, trip in enumerate(active):
            geo = route_geometry(trip.route, fetch=True)
            coords = geo.get("coordinates") or []
            if len(coords) < 2:
                continue
            t = min(0.55, 0.18 + i * 0.08)
            lat, lng, heading, along = interpolate_along(coords, t)
            trip.positions.filter(is_simulated=True).delete()
            GPSPosition.objects.create(
                trip=trip,
                timestamp=timezone.now(),
                latitude=round(lat, 6),
                longitude=round(lng, 6),
                heading=heading,
                speed_kmh=32,
                is_simulated=True,
            )
            trip.current_stop_sequence = passed_stop_sequence(trip.route, along, coords)
            trip.is_simulated = True
            trip.save(update_fields=["current_stop_sequence", "is_simulated"])
            self.stdout.write(f"  placed {trip.route.route_code} at t={t:.2f}")
        self.stdout.write(self.style.SUCCESS(f"Snapped {n} routes onto streets."))
