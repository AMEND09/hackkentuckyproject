from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.machine_learning.models import ModelArtifact, PredictionLog
from common.permissions.roles import HasRole


class ModelArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelArtifact
        fields = (
            "id",
            "district",
            "model_type",
            "version",
            "feature_schema",
            "metrics",
            "training_data_description",
            "is_active",
            "is_synthetic",
            "trained_at",
        )


class ModelArtifactViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ModelArtifactSerializer
    queryset = ModelArtifact.objects.all()
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (
        UserRole.PLATFORM_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.PLANNER,
        UserRole.DISPATCHER,
    )
    filterset_fields = ("model_type", "is_active")

    @action(detail=False, methods=["get"])
    def metrics(self, request):
        rows = self.get_queryset().filter(is_active=True)
        return Response(
            {
                "synthetic": True,
                "disclaimer": "Models are trained on fictional seeded segments only.",
                "models": ModelArtifactSerializer(rows, many=True).data,
            }
        )
