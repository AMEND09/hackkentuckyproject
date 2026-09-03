from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import UserRole
from apps.audit.models import AuditLog
from common.permissions.roles import HasRole
from common.permissions.tenancy import TenantQuerySetMixin


def log_action(actor, action, resource_type, resource_id="", district=None, metadata=None):
    AuditLog.objects.create(
        actor=actor,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id or ""),
        district=district,
        metadata=metadata or {},
    )


class AuditSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ("id", "actor", "actor_email", "action", "resource_type", "resource_id", "metadata", "created_at")


class AuditViewSet(TenantQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditSerializer
    queryset = AuditLog.objects.select_related("actor")
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (UserRole.PLATFORM_ADMIN, UserRole.DISTRICT_ADMIN)
