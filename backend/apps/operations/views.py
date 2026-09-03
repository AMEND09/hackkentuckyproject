from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import GuardianStudentLink, UserRole
from apps.operations.models import Incident, OperationalAlert, StopEvent, Trip
from apps.operations.serializers import (
    AlertSerializer,
    GPSSerializer,
    GuardianETASerializer,
    IncidentSerializer,
    TripDetailSerializer,
    TripListSerializer,
)
from apps.operations.services.lifecycle import broadcast_event, ingest_gps, refresh_trip_eta
from apps.routing.models import RouteStopStudent
from common.exceptions.errors import RouteWiseError
from common.permissions.roles import HasRole
from common.permissions.tenancy import TenantQuerySetMixin

STAFF = (
    UserRole.PLATFORM_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.PLANNER,
    UserRole.DISPATCHER,
)


class TripViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = TripListSerializer
    queryset = Trip.objects.select_related(
        "route__school", "vehicle", "driver__user", "district"
    ).prefetch_related("positions", "alerts", "incidents", "stop_events", "route__stops")
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = STAFF + (UserRole.DRIVER,)
    filterset_fields = ("status", "service_date")

    def get_serializer_class(self):
        if self.action in {"retrieve", "timeline"}:
            return TripDetailSerializer
        return TripListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == UserRole.DRIVER:
            return qs.filter(driver__user=user)
        if self.request.query_params.get("at_risk"):
            qs = qs.order_by("-late_probability", "-current_delay_seconds")
        return qs

    def _driver_or_staff(self, trip):
        user = self.request.user
        if user.role in STAFF:
            return
        if user.role == UserRole.DRIVER and trip.driver and trip.driver.user_id == user.id:
            return
        raise RouteWiseError("You cannot access this trip.", code="FORBIDDEN", status_code=403)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        trip.status = Trip.Status.ACTIVE
        trip.actual_start = timezone.now()
        trip.save()
        refresh_trip_eta(trip)
        broadcast_event(trip, "trip.status.updated", {"status": trip.status})
        return Response(TripDetailSerializer(trip).data)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        trip.status = Trip.Status.PAUSED
        trip.save()
        broadcast_event(trip, "trip.status.updated", {"status": trip.status})
        return Response(TripDetailSerializer(trip).data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        trip.status = Trip.Status.ACTIVE
        trip.save()
        broadcast_event(trip, "trip.status.updated", {"status": trip.status})
        return Response(TripDetailSerializer(trip).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        trip.status = Trip.Status.COMPLETED
        trip.actual_completion = timezone.now()
        trip.save()
        broadcast_event(trip, "trip.status.updated", {"status": trip.status})
        return Response(TripDetailSerializer(trip).data)

    @action(detail=True, methods=["post"], url_path="arrive-stop")
    def arrive_stop(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        rs_id = request.data.get("route_stop_id")
        event, _ = StopEvent.objects.get_or_create(trip=trip, route_stop_id=rs_id)
        event.arrival_time = timezone.now()
        event.save()
        trip.current_stop_sequence = (trip.current_stop_sequence or 0) + 1
        trip.save()
        return Response({"event": event.id, "trip": TripDetailSerializer(trip).data})

    @action(detail=True, methods=["post"], url_path="depart-stop")
    def depart_stop(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        rs_id = request.data.get("route_stop_id")
        event, _ = StopEvent.objects.get_or_create(trip=trip, route_stop_id=rs_id)
        event.departure_time = timezone.now()
        event.boarded_count = int(request.data.get("boarded_count") or event.boarded_count)
        event.absent_count = int(request.data.get("absent_count") or event.absent_count)
        event.save()
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="gps")
    def gps(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        pos = ingest_gps(
            trip,
            request.data.get("latitude"),
            request.data.get("longitude"),
            heading=float(request.data.get("heading") or 0),
            speed=float(request.data.get("speed_kmh") or 0),
            is_simulated=bool(request.data.get("is_simulated")),
        )
        return Response(GPSSerializer(pos).data)

    @action(detail=True, methods=["get"], url_path="manifest")
    def manifest(self, request, pk=None):
        trip = self.get_object()
        self._driver_or_staff(trip)
        if request.user.role == UserRole.GUARDIAN:
            raise RouteWiseError("Guardians cannot view manifests.", code="FORBIDDEN", status_code=403)
        payload = []
        for stop in trip.route.stops.filter(kind="stop"):
            kids = RouteStopStudent.objects.filter(route_stop=stop).select_related("student")
            payload.append(
                {
                    "stop_id": str(stop.id),
                    "stop_name": stop.name,
                    "sequence": stop.sequence,
                    "scheduled_arrival": stop.scheduled_arrival,
                    "students": [
                        {
                            "id": str(k.student_id),
                            "first_name": k.student.first_name,
                            "last_name": k.student.last_name,
                            "wheelchair": k.student.requires_wheelchair,
                            "grade": k.student.grade,
                        }
                        for k in kids
                    ],
                }
            )
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="simulate-step")
    def simulate_step(self, request, pk=None):
        """Dev-only interpolated GPS step along the route polyline."""
        trip = self.get_object()
        self._driver_or_staff(trip)
        if not request.user.is_staff and request.user.role not in set(STAFF) | {UserRole.DRIVER}:
            raise RouteWiseError("Not allowed.", code="FORBIDDEN", status_code=403)
        t = float(request.data.get("t") or 0)
        from apps.routing.services.street_router import interpolate_along, passed_stop_sequence, route_geometry

        geo = route_geometry(trip.route, fetch=True)
        coords = geo.get("coordinates") or []
        if len(coords) < 2:
            raise RouteWiseError("Route has no path to simulate.", code="NO_PATH")
        lat, lng, heading, along = interpolate_along(coords, t)
        pos = ingest_gps(trip, lat, lng, heading=heading, speed=32, is_simulated=True)
        trip.current_stop_sequence = passed_stop_sequence(trip.route, along, coords)
        if trip.status == Trip.Status.SCHEDULED:
            trip.status = Trip.Status.ACTIVE
            trip.actual_start = timezone.now()
        trip.save(update_fields=["current_stop_sequence", "status", "actual_start"])
        return Response(
            {
                "position": GPSSerializer(pos).data,
                "t": t,
                "simulated": True,
                "heading": heading,
                "follows_streets": bool(geo.get("follows_streets")),
            }
        )

    @action(detail=True, methods=["post"], url_path="disrupt")
    def disrupt(self, request, pk=None):
        trip = self.get_object()
        if request.user.role not in STAFF:
            raise RouteWiseError("Dispatchers inject disruptions in demo mode.", code="FORBIDDEN", status_code=403)
        minutes = int(request.data.get("minutes") or 8)
        refresh_trip_eta(trip, extra_delay_s=minutes * 60)
        broadcast_event(trip, "trip.status.updated", {"status": trip.status, "disruption": True})
        return Response(TripDetailSerializer(trip).data)


class AlertViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    queryset = OperationalAlert.objects.select_related("trip__route")
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = STAFF
    filterset_fields = ("is_acknowledged", "severity", "alert_type")

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.is_acknowledged = True
        alert.acknowledged_by = request.user
        alert.acknowledged_at = timezone.now()
        alert.save()
        return Response(AlertSerializer(alert).data)


class IncidentViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = IncidentSerializer
    queryset = Incident.objects.select_related("trip")
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = STAFF + (UserRole.DRIVER,)
    tenant_field = "trip__district_id"

    def perform_create(self, serializer):
        trip = serializer.validated_data["trip"]
        user = self.request.user
        if user.role == UserRole.DRIVER and not (trip.driver and trip.driver.user_id == user.id):
            raise RouteWiseError("Drivers may only report incidents on their trips.", code="FORBIDDEN", status_code=403)
        incident = serializer.save(created_by=user)
        broadcast_event(trip, "incident.updated", {"incident_id": str(incident.id), "status": incident.status})


class GuardianViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _links(self, request):
        if request.user.role != UserRole.GUARDIAN:
            raise RouteWiseError("Guardian role required.", code="FORBIDDEN", status_code=403)
        return GuardianStudentLink.objects.filter(guardian=request.user, is_verified=True).select_related(
            "student__school"
        )

    def children(self, request):
        from apps.transportation.serializers import GuardianChildSerializer

        students = [link.student for link in self._links(request)]
        return Response(GuardianChildSerializer(students, many=True).data)

    def etas(self, request):
        payload = []
        today = timezone.localdate()
        for link in self._links(request):
            rss = (
                RouteStopStudent.objects.filter(student=link.student, action="board")
                .select_related("route_stop__route")
                .first()
            )
            if not rss:
                payload.append(
                    {
                        "student_id": str(link.student_id),
                        "student_first_name": link.student.first_name,
                        "stop_name": None,
                        "scheduled_pickup": None,
                        "status": "unassigned",
                        "delay_seconds": 0,
                        "p50_eta": None,
                        "is_simulated": False,
                        "on_time": True,
                    }
                )
                continue
            trip = (
                Trip.objects.filter(route=rss.route_stop.route, service_date=today)
                .order_by("-created_at")
                .first()
            )
            delay = trip.current_delay_seconds if trip else 0
            payload.append(
                {
                    "student_id": str(link.student_id),
                    "student_first_name": link.student.first_name,
                    "stop_name": rss.route_stop.name,
                    "scheduled_pickup": rss.route_stop.scheduled_arrival,
                    "status": trip.status if trip else "scheduled",
                    "delay_seconds": delay,
                    "p50_eta": trip.current_p50_eta if trip else None,
                    "is_simulated": bool(trip.is_simulated) if trip else False,
                    "on_time": delay < 180,
                }
            )
        return Response(GuardianETASerializer(payload, many=True).data)

    def mark_absent(self, request):
        student_id = request.data.get("student_id")
        link = self._links(request).filter(student_id=student_id).first()
        if not link:
            raise RouteWiseError("Student is not linked to this guardian.", code="FORBIDDEN", status_code=403)
        rss = RouteStopStudent.objects.filter(student=link.student).select_related("route_stop__route").first()
        if rss:
            today = timezone.localdate()
            trip = Trip.objects.filter(route=rss.route_stop.route, service_date=today).first()
            if trip:
                event, _ = StopEvent.objects.get_or_create(trip=trip, route_stop=rss.route_stop)
                event.absent_count = (event.absent_count or 0) + 1
                event.notes = (event.notes or "") + f" Guardian marked {link.student.first_name} absent."
                event.save()
        return Response({"ok": True, "student_id": str(link.student_id)})

    def history(self, request):
        student_ids = list(self._links(request).values_list("student_id", flat=True))
        route_ids = RouteStopStudent.objects.filter(student_id__in=student_ids).values_list(
            "route_stop__route_id", flat=True
        )
        trips = Trip.objects.filter(route_id__in=route_ids).order_by("-service_date")[:20]
        # Do not leak other students
        data = []
        for t in trips:
            data.append(
                {
                    "trip_id": str(t.id),
                    "service_date": t.service_date,
                    "status": t.status,
                    "delay_seconds": t.current_delay_seconds,
                    "school_name": t.route.school.name,
                }
            )
        return Response(data)
