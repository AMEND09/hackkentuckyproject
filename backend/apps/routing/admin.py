from django.contrib import admin

from apps.routing.models import Route, RoutePlan

admin.site.register(RoutePlan)
admin.site.register(Route)
