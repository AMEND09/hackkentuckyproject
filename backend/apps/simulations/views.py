from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import UserRole
from apps.simulations.models import StressTestRun
from apps.simulations.tasks import run_stress_test_task
from common.permissions.roles import HasRole
from common.permissions.tenancy import TenantQuerySetMixin


class StressTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = StressTestRun
        fields = (
            "id",
            "route_plan",
            "compare_plan",
            "status",
            "n_simulations",
            "traffic_severity",
            "weather_severity",
            "rain",
            "snow_day",
            "starting_delay_min",
            "starting_delay_max",
            "boarding_variability",
            "driver_absence_rate",
            "road_disruption_rate",
            "results",
            "interpretation",
            "created_at",
        )
        read_only_fields = ("id", "status", "results", "interpretation", "created_at")


class StressTestViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = StressTestSerializer
    queryset = StressTestRun.objects.select_related("route_plan", "compare_plan")
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (
        UserRole.PLATFORM_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.PLANNER,
        UserRole.DISPATCHER,
    )

    def perform_create(self, serializer):
        run = serializer.save(district=self.request.user.district, created_by=self.request.user)
        run_stress_test_task.delay(str(run.id))
