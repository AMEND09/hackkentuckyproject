from collections import defaultdict
from datetime import datetime, time

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.districts.models import Depot, District, DistrictPolicy, School
from apps.districts.serializers import DepotSerializer, DistrictPolicySerializer, DistrictSerializer, SchoolSerializer
from apps.operations.models import OperationalAlert, Trip
from apps.routing.models import Route
from apps.transportation.models import Student, Vehicle
from common.permissions.roles import HasRole
from common.permissions.tenancy import TenantQuerySetMixin


def _fleet_for_live_board(trips):
    """Today's buses for the live map — include scheduled so a demo start has a fleet immediately."""
    today = timezone.localdate()
    today_trips = [t for t in trips if t.service_date == today]
    live = [t for t in today_trips if t.status == Trip.Status.ACTIVE or t.is_simulated]
    if live:
        return live[:16]
    return today_trips[:16]


def _clock_label(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        value = value.time()
    if not isinstance(value, time):
        return None
    hour = value.hour % 12 or 12
    suffix = "AM" if value.hour < 12 else "PM"
    return f"{hour}:{value.minute:02d} {suffix}"


def _fleet_highlights(trips):
    rows = []
    for trip in trips:
        late = (trip.late_probability or 0) >= 0.45 or (trip.current_delay_seconds or 0) >= 180
        departed = trip.status == Trip.Status.ACTIVE
        stop_total = getattr(trip, "stop_total", None)
        if stop_total is None:
            stop_total = trip.route.stops.count() if trip.route_id else 0
        eta = _clock_label(trip.current_p50_eta) or _clock_label(
            getattr(trip.route, "scheduled_school_arrival", None)
        )
        delay_min = max(0, round((trip.current_delay_seconds or 0) / 60))
        if not departed:
            detail = "Not yet departed"
        elif late and delay_min:
            detail = f"+{delay_min} min" + (f" · {eta}" if eta else "")
        else:
            seq = trip.current_stop_sequence or 0
            detail = f"Stop {seq} of {stop_total}" + (f" · {eta}" if eta else "")
        rows.append(
            {
                "id": str(trip.id),
                "route_code": trip.route.route_code if trip.route_id else "",
                "late": late,
                "departed": departed,
                "detail": detail,
            }
        )
    return rows


def _arrival_by_school(district, trips):
    grouped: dict = defaultdict(list)
    for trip in trips:
        school = getattr(trip.route, "school", None) if trip.route_id else None
        if school:
            grouped[school.id].append(trip)

    rows = []
    schools = School.objects.filter(district=district, is_active=True).order_by("morning_bell_time", "name")[:8]
    for school in schools:
        inbound = grouped.get(school.id, [])
        published = Route.objects.filter(
            school=school, route_plan__status="published", direction=Route.Direction.AM
        ).count()
        etas = [t.current_p50_eta for t in inbound if t.current_p50_eta]
        eta_dt = max(etas) if etas else None
        eta_time = eta_dt.time() if eta_dt else None
        late = bool(eta_time and school.morning_bell_time and eta_time > school.morning_bell_time)
        rows.append(
            {
                "id": str(school.id),
                "name": school.name,
                "inbound_routes": published or len(inbound),
                "bell_time": _clock_label(school.morning_bell_time),
                "eta": _clock_label(eta_dt) or _clock_label(school.morning_bell_time),
                "late": late,
            }
        )
    return rows


class DistrictViewSet(viewsets.ModelViewSet):
    serializer_class = DistrictSerializer
    queryset = District.objects.all()
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (
        UserRole.PLATFORM_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.PLANNER,
        UserRole.DISPATCHER,
        UserRole.DRIVER,
        UserRole.GUARDIAN,
    )
    search_fields = ("name", "slug")

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == UserRole.PLATFORM_ADMIN:
            return qs
        if user.district_id:
            return qs.filter(id=user.district_id)
        return qs.none()

    @action(detail=True, methods=["get"])
    def dashboard(self, request, pk=None):
        district = self.get_object()
        trip_qs = (
            Trip.objects.filter(
                district=district,
                status__in=[Trip.Status.ACTIVE, Trip.Status.SCHEDULED],
            )
            .select_related("route", "route__school", "vehicle", "driver")
            .prefetch_related("route__stops", "positions")
            .annotate(stop_total=Count("route__stops"))
            .order_by("-status", "late_probability", "route__route_code")
        )
        trips = sorted(
            trip_qs,
            key=lambda t: (0 if t.status == Trip.Status.ACTIVE else 1, -(t.late_probability or 0)),
        )
        active_trips = [t for t in trips if t.status == Trip.Status.ACTIVE]
        students = Student.objects.filter(district=district, is_active=True, eligibility=Student.Eligibility.ELIGIBLE)
        vehicles = Vehicle.objects.filter(district=district, is_active=True)
        alerts = OperationalAlert.objects.filter(district=district, is_acknowledged=False)[:8]
        at_risk = sum(1 for t in active_trips if (t.late_probability or 0) >= 0.35)
        delays = [t.current_delay_seconds or 0 for t in active_trips]
        avg_delay = int(sum(delays) / len(delays)) if delays else 0
        from apps.operations.serializers import AlertSerializer, TripListSerializer

        return Response(
            {
                "active_buses": len(active_trips),
                "students_transported": students.count(),
                "on_time_routes": sum(1 for t in active_trips if (t.late_probability or 0) < 0.25),
                "at_risk_routes": at_risk,
                "fleet_utilization": round(
                    len(active_trips) / max(vehicles.filter(status=Vehicle.Status.ACTIVE).count(), 1), 2
                ),
                "average_delay_seconds": avg_delay,
                "open_incidents": district.trips.filter(incidents__status="open").distinct().count()
                if hasattr(district, "trips")
                else 0,
                "recent_alerts": AlertSerializer(alerts, many=True).data,
                "live_trips": TripListSerializer(_fleet_for_live_board(trips), many=True).data,
                "fleet_highlights": _fleet_highlights(trips[:4]),
                "arrival_by_school": _arrival_by_school(district, trips),
                "route_count": Route.objects.filter(route_plan__district=district, route_plan__status="published").count(),
                "synthetic_ml": True,
            }
        )

    @action(detail=True, methods=["post"], url_path="demo/start")
    def demo_start(self, request, pk=None):
        district = self.get_object()
        self._require_staff(request)
        from apps.operations.services.live_demo import start_demo

        return Response(start_demo(district))

    @action(detail=True, methods=["post"], url_path="demo/stop")
    def demo_stop(self, request, pk=None):
        district = self.get_object()
        self._require_staff(request)
        from apps.operations.services.live_demo import stop_demo

        return Response(stop_demo(district))

    @action(detail=True, methods=["get"], url_path="demo/status")
    def demo_status_view(self, request, pk=None):
        district = self.get_object()
        from apps.operations.services.live_demo import demo_status

        return Response(demo_status(district))

    def _require_staff(self, request):
        staff = {
            UserRole.PLATFORM_ADMIN,
            UserRole.DISTRICT_ADMIN,
            UserRole.PLANNER,
            UserRole.DISPATCHER,
        }
        if request.user.role not in staff:
            from common.exceptions.errors import RouteWiseError

            raise RouteWiseError("Only staff can control the live demo.", code="FORBIDDEN", status_code=403)

    @action(detail=True, methods=["get"], url_path="validate-dataset")
    def validate_dataset(self, request, pk=None):
        district = self.get_object()
        students = Student.objects.filter(district=district, is_active=True)
        missing_stop = students.exclude(
            stop_assignments__is_active=True, stop_assignments__bus_stop__is_approved=True
        ).distinct().count()
        issues = []
        if not district.schools.filter(is_active=True).exists():
            issues.append("No active schools")
        if not district.depots.filter(is_active=True).exists():
            issues.append("No depots")
        if missing_stop:
            issues.append(f"{missing_stop} students lack an approved stop assignment")
        wc_need = students.filter(requires_wheelchair=True).count()
        wc_seats = sum(
            Vehicle.objects.filter(district=district, is_active=True).values_list("wheelchair_capacity", flat=True)
        ) or 0
        if wc_need > wc_seats:
            issues.append("Wheelchair capacity is insufficient")
        return Response(
            {
                "ok": not issues,
                "issues": issues,
                "counts": {
                    "schools": district.schools.count(),
                    "depots": district.depots.count(),
                    "students": students.count(),
                    "stops": district.busstops.count() if hasattr(district, "busstops") else 0,
                    "vehicles": district.vehicles.count() if hasattr(district, "vehicles") else 0,
                    "drivers": district.driverprofiles.count() if hasattr(district, "driverprofiles") else 0,
                },
            }
        )


class PolicyViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = DistrictPolicySerializer
    queryset = DistrictPolicy.objects.select_related("district")
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (UserRole.PLATFORM_ADMIN, UserRole.DISTRICT_ADMIN, UserRole.PLANNER)
    tenant_field = "district_id"


class SchoolViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = SchoolSerializer
    queryset = School.objects.annotate(student_count=Count("students", filter=Q(students__is_active=True)))
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (
        UserRole.PLATFORM_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.PLANNER,
        UserRole.DISPATCHER,
    )
    search_fields = ("name", "school_code", "address")
    filterset_fields = ("school_type", "is_active")

    def perform_create(self, serializer):
        serializer.save(district=self.request.user.district)


class DepotViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = DepotSerializer
    queryset = Depot.objects.all()
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (
        UserRole.PLATFORM_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.PLANNER,
        UserRole.DISPATCHER,
    )
    search_fields = ("name",)

    def perform_create(self, serializer):
        serializer.save(district=self.request.user.district)
