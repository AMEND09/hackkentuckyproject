from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User, UserRole
from apps.accounts.views import UserSerializer
from common.permissions.roles import HasRole
from common.permissions.tenancy import TenantQuerySetMixin


class UserViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (UserRole.PLATFORM_ADMIN, UserRole.DISTRICT_ADMIN)
    queryset = User.objects.select_related("district").all()
    tenant_field = "district_id"
    search_fields = ("email", "first_name", "last_name")
    filterset_fields = ("role", "is_active")

    def perform_create(self, serializer):
        user = self.request.user
        extra = {}
        if user.role != UserRole.PLATFORM_ADMIN:
            extra["district"] = user.district
        password = self.request.data.get("password") or "ChangeMe123!"
        instance = serializer.save(**extra)
        instance.set_password(password)
        instance.save()
