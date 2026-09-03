from django.urls import path

from apps.operations.consumers import DistrictOperationsConsumer, TripConsumer

websocket_urlpatterns = [
    path("ws/trips/<uuid:trip_id>/", TripConsumer.as_asgi()),
    path("ws/districts/<uuid:district_id>/", DistrictOperationsConsumer.as_asgi()),
]
