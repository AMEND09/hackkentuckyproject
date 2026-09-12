from rest_framework.routers import DefaultRouter

from apps.geodata.views import (
    ConstructionPermitViewSet,
    HighInjurySegmentViewSet,
    MidblockCrossingViewSet,
    PublicSchoolSiteViewSet,
    RoadSegmentViewSet,
    SnowRouteViewSet,
    TrafficSignalViewSet,
)

router = DefaultRouter()
router.register(r"geodata/signals", TrafficSignalViewSet, basename="geodata-signal")
router.register(r"geodata/crossings", MidblockCrossingViewSet, basename="geodata-crossing")
router.register(r"geodata/road-segments", RoadSegmentViewSet, basename="geodata-road-segment")
router.register(r"geodata/high-injury-segments", HighInjurySegmentViewSet, basename="geodata-high-injury")
router.register(r"geodata/snow-routes", SnowRouteViewSet, basename="geodata-snow-route")
router.register(r"geodata/construction-permits", ConstructionPermitViewSet, basename="geodata-construction-permit")
router.register(r"geodata/schools", PublicSchoolSiteViewSet, basename="geodata-school")
urlpatterns = router.urls
