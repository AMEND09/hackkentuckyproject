from django.conf import settings
from django.db import models

from common.utilities.models import TenantModel


class StressTestRun(TenantModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    route_plan = models.ForeignKey("routing.RoutePlan", on_delete=models.CASCADE, related_name="stress_tests")
    compare_plan = models.ForeignKey(
        "routing.RoutePlan",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stress_tests_as_compare",
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    n_simulations = models.PositiveIntegerField(default=750)
    traffic_severity = models.FloatField(default=0.4)
    weather_severity = models.FloatField(default=0.2)
    rain = models.BooleanField(default=False)
    starting_delay_min = models.IntegerField(default=0)
    starting_delay_max = models.IntegerField(default=8)
    boarding_variability = models.FloatField(default=0.3)
    driver_absence_rate = models.FloatField(default=0.02)
    road_disruption_rate = models.FloatField(default=0.05)
    results = models.JSONField(default=dict, blank=True)
    interpretation = models.TextField(blank=True)
