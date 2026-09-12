from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.geodata.models import (
    ConstructionPermit,
    HighInjurySegment,
    MidblockCrossing,
    PublicSchoolSite,
    RoadSegment,
    SnowRoute,
    TrafficSignal,
)
from apps.geodata.serializers import (
    ConstructionPermitSerializer,
    HighInjurySegmentSerializer,
    MidblockCrossingSerializer,
    PublicSchoolSiteSerializer,
    RoadSegmentSerializer,
    SnowRouteSerializer,
    TrafficSignalSerializer,
)


class BBoxFilterMixin:
    """Optional ?bbox=min_lat,min_lng,max_lat,max_lng to scope map layers to the visible viewport."""

    lat_field = "latitude"
    lng_field = "longitude"

    def get_queryset(self):
        qs = super().get_queryset()
        bbox = self.request.query_params.get("bbox")
        if not bbox:
            return qs
        try:
            min_lat, min_lng, max_lat, max_lng = (float(v) for v in bbox.split(","))
        except (ValueError, TypeError):
            return qs
        return qs.filter(
            **{
                f"{self.lat_field}__gte": min_lat,
                f"{self.lat_field}__lte": max_lat,
                f"{self.lng_field}__gte": min_lng,
                f"{self.lng_field}__lte": max_lng,
            }
        )


class TrafficSignalViewSet(BBoxFilterMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = TrafficSignalSerializer
    queryset = TrafficSignal.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ("main_street", "cross_street")


class MidblockCrossingViewSet(BBoxFilterMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = MidblockCrossingSerializer
    queryset = MidblockCrossing.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ("road_name", "cross_street")


class RoadSegmentViewSet(BBoxFilterMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = RoadSegmentSerializer
    queryset = RoadSegment.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ("road_name",)
    lat_field = "midpoint_lat"
    lng_field = "midpoint_lng"


class HighInjurySegmentViewSet(BBoxFilterMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = HighInjurySegmentSerializer
    queryset = HighInjurySegment.objects.all().order_by("priority_rank")
    permission_classes = [IsAuthenticated]
    search_fields = ("road_name", "corridor_name")
    lat_field = "midpoint_lat"
    lng_field = "midpoint_lng"


class SnowRouteViewSet(BBoxFilterMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = SnowRouteSerializer
    queryset = SnowRoute.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ("road_name", "route")
    lat_field = "midpoint_lat"
    lng_field = "midpoint_lng"


class ConstructionPermitViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ConstructionPermitSerializer
    queryset = ConstructionPermit.objects.all().order_by("-from_date")
    permission_classes = [IsAuthenticated]
    search_fields = ("permit_no", "street_address", "applicant_name")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("active") == "true":
            as_of = parse_datetime(self.request.query_params.get("as_of") or "") or timezone.now()
            qs = qs.filter(source=ConstructionPermit.Source.CURRENT).filter(
                Q(from_date__isnull=True) | Q(from_date__lte=as_of)
            ).filter(Q(to_date__isnull=True) | Q(to_date__gte=as_of))
        return qs


class PublicSchoolSiteViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PublicSchoolSiteSerializer
    queryset = PublicSchoolSite.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ("name", "address", "zip_code")
    filterset_fields = ("level", "loc_type")
