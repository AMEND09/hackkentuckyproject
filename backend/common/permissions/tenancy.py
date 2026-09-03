from django.db.models import QuerySet

from apps.accounts.models import UserRole


class TenantQuerySetMixin:
    """Filter district-owned records. Platform admins see all. Drivers/guardians need extra scoping in views."""

    tenant_field = "district_id"

    def get_queryset(self) -> QuerySet:
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.role == UserRole.PLATFORM_ADMIN:
            return qs
        if not user.district_id:
            return qs.none()
        lookup = {self.tenant_field: user.district_id}
        return qs.filter(**lookup)
