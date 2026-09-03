from rest_framework.routers import DefaultRouter

from apps.imports.views import ImportJobViewSet

router = DefaultRouter()
router.register(r"imports", ImportJobViewSet, basename="import")
urlpatterns = router.urls
