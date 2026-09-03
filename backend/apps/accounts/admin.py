from django.contrib import admin

from apps.accounts.models import GuardianStudentLink, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    ordering = ("email",)
    list_display = ("email", "role", "district", "is_active")
    search_fields = ("email", "first_name", "last_name")
    list_filter = ("role", "is_active")


admin.site.register(GuardianStudentLink)
