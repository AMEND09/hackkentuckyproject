"""Real Louisville Metro / LOJIC open-data reference layers.

Unlike apps.transportation and apps.routing, these rows are not tenant-owned:
they describe physical Jefferson County infrastructure (signals, crash
corridors, road classifications, construction permits, snow routes, school
sites) shared by every district on the platform. Loaded via the
`import_louisville_open_data` management command from CSV/GeoJSON exports of
data.louisvilleky.gov and ridetarc.org. See sample_data/louisville_open_data/.
"""

from django.db import models

from common.utilities.models import TimeStampedUUIDModel


class TrafficSignal(TimeStampedUUIDModel):
    """Signalized intersections maintained by Louisville Metro Public Works."""

    source_id = models.CharField(max_length=60, unique=True)
    main_street = models.CharField(max_length=200, blank=True)
    cross_street = models.CharField(max_length=200, blank=True)
    owner = models.CharField(max_length=120, blank=True)
    route = models.CharField(max_length=120, blank=True)
    signal_type = models.CharField(max_length=120, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()

    class Meta:
        ordering = ["source_id"]
        indexes = [models.Index(fields=["latitude", "longitude"])]

    def __str__(self) -> str:
        return f"{self.main_street} & {self.cross_street}"


class MidblockCrossing(TimeStampedUUIDModel):
    """Marked pedestrian crossings away from signalized intersections."""

    source_id = models.CharField(max_length=60, unique=True)
    road_name = models.CharField(max_length=200, blank=True)
    cross_street = models.CharField(max_length=200, blank=True)
    crossing_type = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=80, blank=True)
    has_rrfb_or_signal = models.BooleanField(default=False)
    near_tarc_stop = models.BooleanField(default=False)
    latitude = models.FloatField()
    longitude = models.FloatField()

    class Meta:
        ordering = ["source_id"]
        indexes = [models.Index(fields=["latitude", "longitude"])]


class RoadSegment(TimeStampedUUIDModel):
    """LOJIC road-context classification centerlines (arterial/collector/local, urban context)."""

    source_id = models.CharField(max_length=60, unique=True)
    road_name = models.CharField(max_length=200, blank=True)
    core_class = models.CharField(max_length=80, blank=True)
    context_class = models.CharField(max_length=20, blank=True)
    speed_limit_mph = models.PositiveIntegerField(null=True, blank=True)
    road_category = models.PositiveSmallIntegerField(
        default=0, help_text="0=local/collector, 1=minor arterial, 2=major arterial — matches ML training encoding."
    )
    urban_density = models.FloatField(default=0.5, help_text="0=rural (C1) .. 1=urban core (C6), derived from CONTEXT_CLASS.")
    midpoint_lat = models.FloatField()
    midpoint_lng = models.FloatField()
    geometry = models.JSONField(default=list, blank=True, help_text="[[lng, lat], ...]")

    class Meta:
        ordering = ["source_id"]
        indexes = [models.Index(fields=["midpoint_lat", "midpoint_lng"])]


class HighInjurySegment(TimeStampedUUIDModel):
    """Vision Zero Louisville high-injury network: corridors with disproportionate fatal/serious crashes."""

    source_id = models.CharField(max_length=60, unique=True)
    road_name = models.CharField(max_length=200, blank=True)
    corridor_name = models.CharField(max_length=200, blank=True)
    core_class = models.CharField(max_length=80, blank=True)
    priority_rank = models.FloatField(null=True, blank=True, help_text="Lower is higher priority per LOJIC PRIORITY_R.")
    total_epdo = models.FloatField(null=True, blank=True)
    total_ka_crashes = models.FloatField(null=True, blank=True, help_text="Killed/serious-injury crash count.")
    length_miles = models.FloatField(null=True, blank=True)
    owner = models.CharField(max_length=120, blank=True)
    midpoint_lat = models.FloatField()
    midpoint_lng = models.FloatField()
    geometry = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["source_id"]
        indexes = [models.Index(fields=["midpoint_lat", "midpoint_lng"])]


class SnowRoute(TimeStampedUUIDModel):
    """Public Works priority plow/salt routes."""

    source_id = models.CharField(max_length=60, unique=True)
    road_name = models.CharField(max_length=200, blank=True)
    route = models.CharField(max_length=40, blank=True)
    response = models.CharField(max_length=40, blank=True)
    priority = models.CharField(max_length=20, blank=True)
    state_owned = models.BooleanField(default=False)
    midpoint_lat = models.FloatField()
    midpoint_lng = models.FloatField()
    geometry = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["source_id"]
        indexes = [models.Index(fields=["midpoint_lat", "midpoint_lng"])]


class ConstructionPermit(TimeStampedUUIDModel):
    """Right-of-way construction/closure permits (current + historical)."""

    class Source(models.TextChoices):
        CURRENT = "current", "Currently issued"
        HISTORICAL = "historical", "Historical"

    source_id = models.CharField(max_length=60, unique=True)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.CURRENT)
    permit_no = models.CharField(max_length=60, blank=True)
    applicant_name = models.CharField(max_length=200, blank=True)
    work_type = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    street_address = models.CharField(max_length=300, blank=True)
    from_date = models.DateTimeField(null=True, blank=True)
    to_date = models.DateTimeField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["latitude", "longitude"]),
            models.Index(fields=["from_date", "to_date"]),
        ]

    def is_active_on(self, when) -> bool:
        if self.from_date and when < self.from_date:
            return False
        if self.to_date and when > self.to_date:
            return False
        return True


class PublicSchoolSite(TimeStampedUUIDModel):
    """Reference directory of every public/private/parochial school site in Jefferson County (LOJIC).

    Independent of apps.districts.School — that model holds fictional demo
    schools. This is real, publicly published address data used to help
    planners look up real Jefferson County school locations.
    """

    source_id = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=200)
    level = models.CharField(max_length=20, blank=True)
    loc_type = models.CharField(max_length=40, blank=True)
    address = models.CharField(max_length=300, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=4, blank=True)
    zip_code = models.CharField(max_length=12, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    abbreviation = models.CharField(max_length=40, blank=True)
    website = models.CharField(max_length=200, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["latitude", "longitude"])]

    def __str__(self) -> str:
        return self.name
