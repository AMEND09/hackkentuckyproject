from rest_framework.routers import DefaultRouter

from apps.machine_learning.views import ModelArtifactViewSet

router = DefaultRouter()
router.register(r"model-artifacts", ModelArtifactViewSet, basename="model-artifact")
urlpatterns = router.urls
