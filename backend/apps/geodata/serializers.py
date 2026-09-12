from rest_framework import serializers

from apps.geodata.models import (
    ConstructionPermit,
    HighInjurySegment,
    MidblockCrossing,
    PublicSchoolSite,
    RoadSegment,
    SnowRoute,
    TrafficSignal,
)


class TrafficSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficSignal
        fields = ("id", "main_street", "cross_street", "owner", "route", "signal_type", "latitude", "longitude")


class MidblockCrossingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MidblockCrossing
        fields = (
            "id",
            "road_name",
            "cross_street",
            "crossing_type",
            "status",
            "has_rrfb_or_signal",
            "near_tarc_stop",
            "latitude",
            "longitude",
        )


class RoadSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoadSegment
        fields = (
            "id",
            "road_name",
            "core_class",
            "context_class",
            "speed_limit_mph",
            "road_category",
            "urban_density",
            "midpoint_lat",
            "midpoint_lng",
            "geometry",
        )


class HighInjurySegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = HighInjurySegment
        fields = (
            "id",
            "road_name",
            "corridor_name",
            "core_class",
            "priority_rank",
            "total_epdo",
            "total_ka_crashes",
            "length_miles",
            "midpoint_lat",
            "midpoint_lng",
            "geometry",
        )


class SnowRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SnowRoute
        fields = (
            "id",
            "road_name",
            "route",
            "response",
            "priority",
            "state_owned",
            "midpoint_lat",
            "midpoint_lng",
            "geometry",
        )


class ConstructionPermitSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = ConstructionPermit
        fields = (
            "id",
            "source",
            "permit_no",
            "applicant_name",
            "work_type",
            "description",
            "street_address",
            "from_date",
            "to_date",
            "latitude",
            "longitude",
            "is_active",
        )

    def get_is_active(self, obj):
        from django.utils import timezone

        return obj.is_active_on(timezone.now())


class PublicSchoolSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicSchoolSite
        fields = (
            "id",
            "name",
            "level",
            "loc_type",
            "address",
            "city",
            "state",
            "zip_code",
            "phone",
            "abbreviation",
            "website",
            "latitude",
            "longitude",
        )
