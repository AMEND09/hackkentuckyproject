from django.utils import timezone
from rest_framework import serializers

from apps.operations.models import GPSPosition, Incident, OperationalAlert, StopEvent, Trip
from apps.routing.models import RouteStopStudent


class GPSSerializer(serializers.ModelSerializer):
    class Meta:
        model = GPSPosition
        fields = (
            "id",
            "timestamp",
            "latitude",
            "longitude",
            "heading",
            "speed_kmh",
            "accuracy_m",
            "is_simulated",
        )


class StopEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = StopEvent
        fields = (
            "id",
            "route_stop",
            "arrival_time",
            "departure_time",
            "boarded_count",
            "absent_count",
            "notes",
        )


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = (
            "id",
            "trip",
            "type",
            "severity",
            "description",
            "status",
            "created_by",
            "acknowledged_by",
            "resolution_notes",
            "created_at",
        )
        read_only_fields = ("id", "created_by", "acknowledged_by", "created_at")


class AlertSerializer(serializers.ModelSerializer):
    route_code = serializers.CharField(source="trip.route.route_code", read_only=True, default=None)

    class Meta:
        model = OperationalAlert
        fields = (
            "id",
            "trip",
            "route_code",
            "alert_type",
            "title",
            "message",
            "severity",
            "probability",
            "is_acknowledged",
            "acknowledged_by",
            "acknowledged_at",
            "created_at",
        )


class TripListSerializer(serializers.ModelSerializer):
    route_code = serializers.CharField(source="route.route_code", read_only=True)
    school_name = serializers.CharField(source="route.school.name", read_only=True)
    vehicle_number = serializers.CharField(source="vehicle.internal_number", read_only=True, default=None)
    driver_name = serializers.SerializerMethodField()
    last_position = serializers.SerializerMethodField()
    path = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = (
            "id",
            "route",
            "route_code",
            "school_name",
            "service_date",
            "status",
            "vehicle",
            "vehicle_number",
            "driver",
            "driver_name",
            "current_delay_seconds",
            "current_stop_sequence",
            "current_p50_eta",
            "current_p90_eta",
            "late_probability",
            "is_simulated",
            "ml_explanation",
            "last_position",
            "path",
        )

    def get_driver_name(self, obj):
        if obj.driver:
            return obj.driver.user.full_name
        return None

    def get_last_position(self, obj):
        pos = obj.positions.order_by("-timestamp").first()
        if not pos:
            return None
        return GPSSerializer(pos).data

    def get_path(self, obj):
        from apps.routing.services.street_router import route_geometry

        geo = route_geometry(obj.route, fetch=True)
        coords = geo.get("coordinates") or []
        if len(coords) >= 2:
            return coords
        return [[float(s.longitude), float(s.latitude)] for s in obj.route.stops.all()]


class TripDetailSerializer(TripListSerializer):
    stop_events = StopEventSerializer(many=True, read_only=True)
    incidents = IncidentSerializer(many=True, read_only=True)
    alerts = AlertSerializer(many=True, read_only=True)
    stops = serializers.SerializerMethodField()
    guidance = serializers.SerializerMethodField()

    class Meta(TripListSerializer.Meta):
        fields = TripListSerializer.Meta.fields + (
            "actual_start",
            "actual_completion",
            "stop_events",
            "incidents",
            "alerts",
            "stops",
            "guidance",
        )

    def get_path(self, obj):
        from apps.routing.services.street_router import route_geometry

        geo = route_geometry(obj.route, fetch=True)
        coords = geo.get("coordinates") or []
        if len(coords) >= 2:
            return coords
        return [[float(s.longitude), float(s.latitude)] for s in obj.route.stops.all()]

    def get_stops(self, obj):
        from apps.routing.views import RouteStopSerializer

        return RouteStopSerializer(obj.route.stops.all(), many=True).data

    def get_guidance(self, obj):
        from apps.operations.services.guidance import trip_guidance

        return trip_guidance(obj)


class DriverManifestSerializer(serializers.Serializer):
    stop_id = serializers.UUIDField()
    stop_name = serializers.CharField()
    sequence = serializers.IntegerField()
    students = serializers.ListField()


class GuardianETASerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    student_first_name = serializers.CharField()
    stop_name = serializers.CharField()
    scheduled_pickup = serializers.TimeField(allow_null=True)
    status = serializers.CharField()
    delay_seconds = serializers.IntegerField()
    p50_eta = serializers.DateTimeField(allow_null=True)
    is_simulated = serializers.BooleanField()
    on_time = serializers.BooleanField()
