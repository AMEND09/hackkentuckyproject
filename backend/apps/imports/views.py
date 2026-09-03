from django.http import HttpResponse
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.imports.models import ImportJob, ImportRowError
from apps.imports.services import commit_job, confirm_mapping, errors_csv, store_upload
from common.permissions.roles import HasRole
from common.permissions.tenancy import TenantQuerySetMixin


class ImportRowErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRowError
        fields = ("id", "row_number", "field", "error_code", "message", "raw_row")


class ImportJobSerializer(serializers.ModelSerializer):
    row_errors = ImportRowErrorSerializer(many=True, read_only=True)

    class Meta:
        model = ImportJob
        fields = (
            "id",
            "district",
            "import_type",
            "original_filename",
            "status",
            "proposed_column_mapping",
            "confirmed_column_mapping",
            "validation_results",
            "preview_rows",
            "headers",
            "total_rows",
            "valid_rows",
            "invalid_rows",
            "created_at",
            "row_errors",
        )
        read_only_fields = fields


class ImportJobViewSet(TenantQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ImportJobSerializer
    queryset = ImportJob.objects.prefetch_related("row_errors").all()
    permission_classes = [IsAuthenticated, HasRole]
    allowed_roles = (UserRole.PLATFORM_ADMIN, UserRole.DISTRICT_ADMIN, UserRole.PLANNER)
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ("import_type", "status")

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        uploaded = request.FILES.get("file")
        import_type = request.data.get("import_type")
        if not uploaded or import_type not in ImportJob.ImportType.values:
            from common.exceptions.errors import RouteWiseError

            raise RouteWiseError("file and import_type are required.", code="INVALID_IMPORT")
        job = ImportJob.objects.create(
            district=request.user.district,
            import_type=import_type,
            original_filename=uploaded.name,
            created_by=request.user,
        )
        store_upload(job, uploaded)
        return Response(ImportJobSerializer(job).data, status=201)

    @action(detail=True, methods=["post"], url_path="confirm-mapping")
    def confirm(self, request, pk=None):
        job = self.get_object()
        mapping = request.data.get("mapping") or request.data
        confirm_mapping(job, mapping)
        job.refresh_from_db()
        return Response(ImportJobSerializer(job).data)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate_endpoint(self, request, pk=None):
        from apps.imports.services import validate_job

        job = validate_job(self.get_object())
        return Response(ImportJobSerializer(job).data)

    @action(detail=True, methods=["post"], url_path="commit")
    def commit(self, request, pk=None):
        job = commit_job(self.get_object())
        return Response(ImportJobSerializer(job).data)

    @action(detail=True, methods=["get"], url_path="errors.csv")
    def download_errors(self, request, pk=None):
        job = self.get_object()
        resp = HttpResponse(errors_csv(job), content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="import-{job.id}-errors.csv"'
        return resp

    @action(detail=False, methods=["get"], url_path="templates/(?P<kind>[^/.]+)", permission_classes=[AllowAny])
    def template(self, request, kind=None):
        from pathlib import Path

        from django.conf import settings as dj

        path = Path(dj.REPO_ROOT) / "sample_data" / f"{kind}.csv"
        if not path.exists():
            from common.exceptions.errors import RouteWiseError

            raise RouteWiseError("Unknown template.", code="NOT_FOUND", status_code=404)
        resp = HttpResponse(path.read_text(encoding="utf-8"), content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="{kind}.csv"'
        return resp
