from rest_framework.permissions import BasePermission

from apps.accounts.models import UserRole


class IsAuthenticatedAndActive(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.PLATFORM_ADMIN
        )


class HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        roles = getattr(view, "allowed_roles", None) or self.allowed_roles
        if not roles:
            return True
        if user.role == UserRole.PLATFORM_ADMIN:
            return True
        return user.role in roles


class TenantScopedPermission(BasePermission):
    """Staff roles may access their district; platform admins access all."""

    staff_roles = {
        UserRole.PLATFORM_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.PLANNER,
        UserRole.DISPATCHER,
    }

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == UserRole.PLATFORM_ADMIN:
            return True
        district_id = getattr(user, "district_id", None)
        obj_district = getattr(obj, "district_id", None)
        if obj_district is None and hasattr(obj, "district"):
            obj_district = getattr(obj.district, "id", None)
        if obj_district is None and hasattr(obj, "route"):
            obj_district = obj.route.route_plan.district_id
        return district_id is not None and str(obj_district) == str(district_id)
