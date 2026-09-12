from django.core.files.uploadedfile import SimpleUploadedFile

from apps.imports.models import ImportJob
from apps.imports.services import store_upload, validate_job
from apps.imports.services.mapper import detect_import_type
from tests.conftest import api


def test_csv_validation_duplicate_and_coords(district, planner, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    csv = b"""student_id,first_name,last_name,school_id,latitude,longitude
S-1,Ava,Bennett,OAK-ES,38.24,-85.73
S-1,Leo,Kim,OAK-ES,99.0,-85.73
S-2,Mia,Santos,OAK-ES,not-a-coord,-85.73
"""
    job = ImportJob.objects.create(
        district=district, import_type="students", original_filename="students.csv", created_by=planner
    )
    store_upload(job, SimpleUploadedFile("students.csv", csv))
    mapping = {
        "student_id": {"header": "student_id"},
        "first_name": {"header": "first_name"},
        "last_name": {"header": "last_name"},
        "school_id": {"header": "school_id"},
        "latitude": {"header": "latitude"},
        "longitude": {"header": "longitude"},
        "grade": {"header": None},
        "home_address": {"header": None},
        "eligible": {"header": None},
        "wheelchair": {"header": None},
        "max_ride_minutes": {"header": None},
    }
    job.confirmed_column_mapping = mapping
    job.save()
    validate_job(job)
    codes = set(job.row_errors.values_list("error_code", flat=True))
    assert "DUPLICATE_ID" in codes
    assert "MALFORMED_COORDINATE" in codes


def test_detect_import_type_from_filename_and_headers():
    assert detect_import_type(["anything"], "schools.csv") == "schools"
    assert detect_import_type(["anything"], "happy_path-students.csv") == "students"
    assert detect_import_type(
        ["school_id", "name", "latitude", "longitude"],
        "roster.csv",
    ) == "schools"
    assert detect_import_type(
        ["vehicle_number", "capacity", "license_plate"],
        "fleet.csv",
    ) == "vehicles"


def test_ingest_commits_schools_from_drop(district, planner, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    csv = b"""school_id,name,latitude,longitude
NEW-ES,North Elementary,38.25,-85.72
"""
    client = api(planner)
    resp = client.post(
        "/api/v1/imports/ingest/",
        {"file": SimpleUploadedFile("schools.csv", csv, content_type="text/csv")},
        format="multipart",
    )
    assert resp.status_code == 201
    assert resp.data["import_type"] == "schools"
    assert resp.data["status"] == "committed"
    assert district.schools.filter(school_code="NEW-ES").exists()
