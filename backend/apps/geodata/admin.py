from django.contrib import admin

from apps.geodata.models import (
    ConstructionPermit,
    HighInjurySegment,
    MidblockCrossing,
    PublicSchoolSite,
    RoadSegment,
    SnowRoute,
    TrafficSignal,
)


@admin.register(TrafficSignal)
class TrafficSignalAdmin(admin.ModelAdmin):
    list_display = ("main_street", "cross_street", "owner", "latitude", "longitude")
    search_fields = ("main_street", "cross_street", "source_id")


@admin.register(MidblockCrossing)
class MidblockCrossingAdmin(admin.ModelAdmin):
    list_display = ("road_name", "cross_street", "crossing_type", "status")
    search_fields = ("road_name", "cross_street")


@admin.register(RoadSegment)
class RoadSegmentAdmin(admin.ModelAdmin):
    list_display = ("road_name", "core_class", "context_class", "road_category", "urban_density")
    search_fields = ("road_name",)
    list_filter = ("core_class", "context_class")


@admin.register(HighInjurySegment)
class HighInjurySegmentAdmin(admin.ModelAdmin):
    list_display = ("road_name", "corridor_name", "priority_rank", "total_ka_crashes")
    search_fields = ("road_name", "corridor_name")
    ordering = ("priority_rank",)


@admin.register(SnowRoute)
class SnowRouteAdmin(admin.ModelAdmin):
    list_display = ("road_name", "route", "priority", "response", "state_owned")
    search_fields = ("road_name", "route")


@admin.register(ConstructionPermit)
class ConstructionPermitAdmin(admin.ModelAdmin):
    list_display = ("permit_no", "work_type", "street_address", "from_date", "to_date", "source")
    search_fields = ("permit_no", "street_address", "applicant_name")
    list_filter = ("source", "work_type")


@admin.register(PublicSchoolSite)
class PublicSchoolSiteAdmin(admin.ModelAdmin):
    list_display = ("name", "level", "loc_type", "city", "zip_code")
    search_fields = ("name", "address")
    list_filter = ("level", "loc_type")
