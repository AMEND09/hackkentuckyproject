from rest_framework.routers import DefaultRouter

from apps.simulations.views import StressTestViewSet

router = DefaultRouter()
router.register(r"stress-tests", StressTestViewSet, basename="stress-test")
urlpatterns = router.urls
