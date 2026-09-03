from rest_framework.routers import DefaultRouter

from apps.routing.views import JobViewSet, RoutePlanViewSet

router = DefaultRouter()
router.register(r"route-plans", RoutePlanViewSet, basename="route-plan")
router.register(r"jobs", JobViewSet, basename="job")
urlpatterns = router.urls
