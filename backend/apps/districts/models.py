from common.utilities.models import TenantModel, TimeStampedUUIDModel
from django.db import models


class District(TimeStampedUUIDModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    state = models.CharField(max_length=2, default="KY")
    timezone = models.CharField(max_length=64, default="America/Kentucky/Louisville")
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class DistrictPolicy(TimeStampedUUIDModel):
    district = models.OneToOneField(District, on_delete=models.CASCADE, related_name="policy")
    max_walking_distance_m = models.JSONField(
        default=dict,
        help_text='{"elementary": 400, "middle": 600, "high": 800}',
    )
    max_student_ride_minutes = models.PositiveIntegerField(default=45)
    min_arrival_buffer_minutes = models.PositiveIntegerField(default=10)
    default_boarding_seconds = models.PositiveIntegerField(default=20)
    wheelchair_boarding_seconds = models.PositiveIntegerField(default=90)
    allowable_early_minutes = models.PositiveIntegerField(default=20)
    allowable_late_minutes = models.PositiveIntegerField(default=0)
    reliability_target = models.FloatField(default=0.9)
    extra_constraints = models.JSONField(default=dict, blank=True)


class School(TenantModel):
    class SchoolType(models.TextChoices):
        ELEMENTARY = "elementary", "Elementary"
        MIDDLE = "middle", "Middle"
        HIGH = "high", "High"

    name = models.CharField(max_length=200)
    school_code = models.CharField(max_length=40)
    school_type = models.CharField(max_length=20, choices=SchoolType.choices)
    address = models.CharField(max_length=300)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    morning_bell_time = models.TimeField()
    dismissal_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("district", "school_code")
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Depot(TenantModel):
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=300)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
