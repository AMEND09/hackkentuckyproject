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
        active_trips = Trip.objects.filter(district=district, status=Trip.Status.ACTIVE)
        students = Student.objects.filter(district=district, is_active=True, eligibility=Student.Eligibility.ELIGIBLE)
        vehicles = Vehicle.objects.filter(district=district, is_active=True)
        alerts = OperationalAlert.objects.filter(district=district, is_acknowledged=False)[:8]
        at_risk = active_trips.filter(late_probability__gte=0.35).count()
        delays = list(active_trips.values_list("current_delay_seconds", flat=True))
        avg_delay = int(sum(delays) / len(delays)) if delays else 0
        from apps.operations.serializers import AlertSerializer, TripListSerializer

        return Response(
            {
                "active_buses": active_trips.count(),
                "students_transported": students.count(),
                "on_time_routes": active_trips.filter(late_probability__lt=0.25).count(),
                "at_risk_routes": at_risk,
                "fleet_utilization": round(
                    active_trips.count() / max(vehicles.filter(status=Vehicle.Status.ACTIVE).count(), 1), 2
                ),
                "average_delay_seconds": avg_delay,
                "open_incidents": district.trips.filter(incidents__status="open").distinct().count()
                if hasattr(district, "trips")
                else 0,
                "recent_alerts": AlertSerializer(alerts, many=True).data,
                "live_trips": TripListSerializer(
                    active_trips.select_related("route", "vehicle", "driver").prefetch_related("route__stops", "positions"),
                    many=True,
                ).data,
                "route_count": Route.objects.filter(route_plan__district=district, route_plan__status="published").count(),
                "synthetic_ml": True,
            }
        )

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
    queryset = School.objects.all()
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
