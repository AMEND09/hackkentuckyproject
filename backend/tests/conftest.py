from datetime import time

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import GuardianStudentLink, UserRole
from apps.districts.models import Depot, District, DistrictPolicy, School
from apps.transportation.models import BusStop, DriverProfile, Student, StudentStopAssignment, Vehicle

User = get_user_model()


@pytest.fixture
def district(db):
    d = District.objects.create(
        name="Jefferson Demo Schools",
        slug="jefferson-demo",
        state="KY",
        contact_email="t@jefferson.demo",
    )
    DistrictPolicy.objects.create(district=d)
    return d


@pytest.fixture
def other_district(db):
    return District.objects.create(
        name="Other Demo",
        slug="other-demo",
        state="KY",
        contact_email="o@other.demo",
    )


def _user(email, role, district=None, password="DemoPass123!"):
    u = User.objects.create_user(
        email=email,
        password=password,
        first_name="Test",
        last_name="User",
        role=role,
        district=district,
        is_staff=role == UserRole.PLATFORM_ADMIN,
    )
    return u


@pytest.fixture
def platform_admin(db):
    return _user("platform@routewise.demo", UserRole.PLATFORM_ADMIN)


@pytest.fixture
def district_admin(district):
    return _user("admin@jefferson.demo", UserRole.DISTRICT_ADMIN, district)


@pytest.fixture
def planner(district):
    return _user("planner@jefferson.demo", UserRole.PLANNER, district)


@pytest.fixture
def dispatcher(district):
    return _user("dispatcher@jefferson.demo", UserRole.DISPATCHER, district)


@pytest.fixture
def driver_user(district):
    u = _user("driver@jefferson.demo", UserRole.DRIVER, district)
    DriverProfile.objects.create(user=u, district=district, employee_id="D-1001")
    return u


@pytest.fixture
def guardian(district):
    return _user("guardian@jefferson.demo", UserRole.GUARDIAN, district)


@pytest.fixture
def school(district):
    return School.objects.create(
        district=district,
        name="Oakridge Elementary",
        school_code="OAK-ES",
        school_type=School.SchoolType.ELEMENTARY,
        address="1 Oak",
        latitude=38.2412,
        longitude=-85.7245,
        morning_bell_time=time(8, 15),
        dismissal_time=time(14, 45),
    )


@pytest.fixture
def depot(district):
    return Depot.objects.create(
        district=district,
        name="Central Yard",
        address="900 Industry",
        latitude=38.215,
        longitude=-85.74,
    )


@pytest.fixture
def student(district, school):
    return Student.objects.create(
        district=district,
        external_id="S-1",
        first_name="Ava",
        last_name="Bennett",
        grade="2",
        school=school,
        home_address="512 Maple",
        latitude=38.247,
        longitude=-85.731,
    )


@pytest.fixture
def other_student(other_district):
    sch = School.objects.create(
        district=other_district,
        name="Other ES",
        school_code="OTH",
        school_type=School.SchoolType.ELEMENTARY,
        address="x",
        latitude=38.2,
        longitude=-85.7,
        morning_bell_time=time(8, 0),
        dismissal_time=time(15, 0),
    )
    return Student.objects.create(
        district=other_district,
        external_id="S-X",
        first_name="Secret",
        last_name="Child",
        grade="3",
        school=sch,
        home_address="hidden",
        latitude=38.21,
        longitude=-85.71,
    )


@pytest.fixture
def linked_guardian(guardian, student):
    GuardianStudentLink.objects.create(guardian=guardian, student=student, is_verified=True)
    return guardian


def api(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user=user)
    return client
