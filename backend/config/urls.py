from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.accounts.views import DemoCredentialsView, MeView, TokenRefreshView, login_view, logout_view


def health(_request):
    return JsonResponse({"status": "ok", "service": "routewise"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/auth/login/", login_view, name="login"),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/v1/auth/logout/", logout_view, name="logout"),
    path("api/v1/auth/me/", MeView.as_view(), name="me"),
    path("api/v1/auth/demo-credentials/", DemoCredentialsView.as_view(), name="demo-credentials"),
    path("api/v1/", include("apps.districts.urls")),
    path("api/v1/", include("apps.transportation.urls")),
    path("api/v1/", include("apps.imports.urls")),
    path("api/v1/", include("apps.routing.urls")),
    path("api/v1/", include("apps.machine_learning.urls")),
    path("api/v1/", include("apps.simulations.urls")),
    path("api/v1/", include("apps.operations.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.audit.urls")),
]
