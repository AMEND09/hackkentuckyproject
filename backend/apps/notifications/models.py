from django.conf import settings
from django.db import models

from common.utilities.models import TenantModel


class Notification(TenantModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    body = models.TextField()
    event_type = models.CharField(max_length=40)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
