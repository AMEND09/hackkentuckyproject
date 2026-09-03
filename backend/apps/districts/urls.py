from rest_framework.routers import DefaultRouter

from apps.accounts.user_views import UserViewSet
from apps.districts.views import DepotViewSet, DistrictViewSet, PolicyViewSet, SchoolViewSet

router = DefaultRouter()
router.register(r"districts", DistrictViewSet, basename="district")
router.register(r"policies", PolicyViewSet, basename="policy")
router.register(r"schools", SchoolViewSet, basename="school")
router.register(r"depots", DepotViewSet, basename="depot")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = router.urls
