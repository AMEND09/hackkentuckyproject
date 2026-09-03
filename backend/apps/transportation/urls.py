from rest_framework.routers import DefaultRouter

from apps.transportation.views import (
    AssignmentViewSet,
    BusStopViewSet,
    DriverViewSet,
    GuardianLinkViewSet,
    StudentViewSet,
    VehicleViewSet,
)

router = DefaultRouter()
router.register(r"vehicles", VehicleViewSet, basename="vehicle")
router.register(r"drivers", DriverViewSet, basename="driver")
router.register(r"students", StudentViewSet, basename="student")
router.register(r"stops", BusStopViewSet, basename="stop")
router.register(r"stop-assignments", AssignmentViewSet, basename="assignment")
router.register(r"guardian-links", GuardianLinkViewSet, basename="guardian-link")

urlpatterns = router.urls
