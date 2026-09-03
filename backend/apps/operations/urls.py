from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.operations.views import AlertViewSet, GuardianViewSet, IncidentViewSet, TripViewSet

router = DefaultRouter()
router.register(r"trips", TripViewSet, basename="trip")
router.register(r"alerts", AlertViewSet, basename="alert")
router.register(r"incidents", IncidentViewSet, basename="incident")

guardian = GuardianViewSet.as_view

urlpatterns = router.urls + [
    path("guardian/children/", GuardianViewSet.as_view({"get": "children"})),
    path("guardian/etas/", GuardianViewSet.as_view({"get": "etas"})),
    path("guardian/absent/", GuardianViewSet.as_view({"post": "mark_absent"})),
    path("guardian/history/", GuardianViewSet.as_view({"get": "history"})),
]
