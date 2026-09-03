from django.conf import settings
from django.db import models

from common.utilities.models import TenantModel, TimeStampedUUIDModel


class ImportJob(TenantModel):
    class ImportType(models.TextChoices):
        SCHOOLS = "schools", "Schools"
        STUDENTS = "students", "Students"
        DRIVERS = "drivers", "Drivers"
        VEHICLES = "vehicles", "Vehicles"
        STOPS = "stops", "Stops"

    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        MAPPED = "mapped", "Mapped"
        VALIDATED = "validated", "Validated"
        COMMITTED = "committed", "Committed"
        FAILED = "failed", "Failed"

    import_type = models.CharField(max_length=20, choices=ImportType.choices)
    original_filename = models.CharField(max_length=255)
    stored_path = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADED)
    proposed_column_mapping = models.JSONField(default=dict, blank=True)
    confirmed_column_mapping = models.JSONField(default=dict, blank=True)
    validation_results = models.JSONField(default=dict, blank=True)
    preview_rows = models.JSONField(default=list, blank=True)
    headers = models.JSONField(default=list, blank=True)
    total_rows = models.PositiveIntegerField(default=0)
    valid_rows = models.PositiveIntegerField(default=0)
    invalid_rows = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)


class ImportRowError(TimeStampedUUIDModel):
    import_job = models.ForeignKey(ImportJob, on_delete=models.CASCADE, related_name="row_errors")
    row_number = models.PositiveIntegerField()
    field = models.CharField(max_length=80, blank=True)
    error_code = models.CharField(max_length=40)
    message = models.CharField(max_length=400)
    raw_row = models.JSONField(default=dict)
