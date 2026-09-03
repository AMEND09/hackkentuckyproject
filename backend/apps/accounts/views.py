from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTRefreshView

from apps.accounts.models import User, UserRole
from common.exceptions.errors import RouteWiseError
from common.permissions.roles import HasRole


class UserSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source="district.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "district",
            "district_name",
            "is_active",
            "last_login",
        )
        read_only_fields = ("id", "last_login")


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


def _tokens_for(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=ser.validated_data["email"],
            password=ser.validated_data["password"],
        )
        if user is None or not user.is_active:
            raise RouteWiseError("Invalid email or password.", code="INVALID_CREDENTIALS", status_code=401)
        return Response({"user": UserSerializer(user).data, "tokens": _tokens_for(user)})


login_view = LoginView.as_view()


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh")
        if token:
            try:
                RefreshToken(token).blacklist()
            except Exception:
                pass
        return Response({"detail": "Logged out."})


logout_view = LogoutView.as_view()


class TokenRefreshView(SimpleJWTRefreshView):
    permission_classes = [AllowAny]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        ser = UserSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        # Guardians/drivers cannot change role or district
        forbidden = {"role", "district", "is_active"}
        if request.user.role not in {UserRole.PLATFORM_ADMIN, UserRole.DISTRICT_ADMIN}:
            for key in forbidden:
                ser.validated_data.pop(key, None)
        ser.save()
        return Response(ser.data)


class DemoCredentialsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        if not settings.DEMO_MODE:
            return Response({"demo_mode": False, "accounts": []})
        return Response(
            {
                "demo_mode": True,
                "password": settings.DEMO_PASSWORD,
                "accounts": [
                    {"role": "platform_admin", "email": settings.DEMO_PLATFORM_EMAIL, "label": "Platform admin"},
                    {"role": "district_admin", "email": settings.DEMO_DISTRICT_ADMIN_EMAIL, "label": "District admin"},
                    {"role": "planner", "email": settings.DEMO_PLANNER_EMAIL, "label": "Planner"},
                    {"role": "dispatcher", "email": settings.DEMO_DISPATCHER_EMAIL, "label": "Dispatcher"},
                    {"role": "driver", "email": settings.DEMO_DRIVER_EMAIL, "label": "Driver"},
                    {"role": "guardian", "email": settings.DEMO_GUARDIAN_EMAIL, "label": "Guardian"},
                ],
            }
        )


class UserAdminViewSet:
    """Imported from views_users to keep accounts.views focused on auth."""
