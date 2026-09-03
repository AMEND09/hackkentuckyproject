from rest_framework.routers import DefaultRouter

from apps.audit.views import AuditViewSet

router = DefaultRouter()
router.register(r"audit-logs", AuditViewSet, basename="audit")
urlpatterns = router.urls
