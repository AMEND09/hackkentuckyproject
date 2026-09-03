from django.db import models

from common.utilities.models import TenantModel, TimeStampedUUIDModel


class ModelArtifact(TimeStampedUUIDModel):
    class ModelType(models.TextChoices):
        P50_TRAVEL = "p50_travel", "P50 travel time"
        P90_TRAVEL = "p90_travel", "P90 travel time"
        LATE_CLASSIFIER = "late_classifier", "Late arrival classifier"

    district = models.ForeignKey(
        "districts.District",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="model_artifacts",
    )
    model_type = models.CharField(max_length=40, choices=ModelType.choices)
    version = models.CharField(max_length=40)
    file_path = models.CharField(max_length=500)
    feature_schema = models.JSONField(default=list)
    metrics = models.JSONField(default=dict, blank=True)
    training_data_description = models.TextField(
        default="Synthetic fictional school-morning segments. Not real student or operational data."
    )
    is_active = models.BooleanField(default=True)
    is_synthetic = models.BooleanField(default=True)
    trained_at = models.DateTimeField(null=True, blank=True)


class PredictionLog(TimeStampedUUIDModel):
    model_artifact = models.ForeignKey(ModelArtifact, null=True, on_delete=models.SET_NULL, related_name="predictions")
    trip = models.ForeignKey("operations.Trip", null=True, blank=True, on_delete=models.SET_NULL)
    route = models.ForeignKey("routing.Route", null=True, blank=True, on_delete=models.SET_NULL)
    segment_ref = models.CharField(max_length=120, blank=True)
    feature_payload = models.JSONField(default=dict)
    prediction = models.JSONField(default=dict)
    actual_result = models.JSONField(null=True, blank=True)
