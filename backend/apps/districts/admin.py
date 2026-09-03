from django.contrib import admin

from apps.districts.models import Depot, District, DistrictPolicy, School

admin.site.register(District)
admin.site.register(DistrictPolicy)
admin.site.register(School)
admin.site.register(Depot)
