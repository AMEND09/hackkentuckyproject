import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTRefreshView

from apps.accounts.models import User, UserRole
from apps.districts.models import Depot, District, DistrictPolicy
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


class RegisterSerializer(serializers.Serializer):
    district_name = serializers.CharField(max_length=200)
    first_name = serializers.CharField(max_length=120)
    last_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


def _unique_slug(name: str) -> str:
    base = slugify(name) or "district"
    slug = base
    while District.objects.filter(slug=slug).exists():
        slug = f"{base}-{uuid.uuid4().hex[:6]}"
    return slug


class RegisterView(APIView):
    """Self-service signup: creates a district and its first district admin.

    Also provisions a default policy and depot so the account can generate
    routes immediately after importing roster data.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        district = District.objects.create(
            name=data["district_name"].strip(),
            slug=_unique_slug(data["district_name"]),
            contact_email=data["email"],
            contact_phone=data.get("phone", ""),
        )
        DistrictPolicy.objects.get_or_create(district=district)
        # Default depot so vehicles and the optimizer have a start/anchor point.
        # Matches the provided starter CSV cluster; editable later.
        Depot.objects.create(
            district=district,
            name="Main Bus Depot",
            address="1200 Depot Rd, Summit Valley",
            latitude=40.0155,
            longitude=-83.0300,
            is_active=True,
        )
        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"].strip(),
            last_name=data["last_name"].strip(),
            phone=data.get("phone", ""),
            role=UserRole.DISTRICT_ADMIN,
            district=district,
            is_active=True,
        )
        return Response({"user": UserSerializer(user).data, "tokens": _tokens_for(user)}, status=201)


register_view = RegisterView.as_view()


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
