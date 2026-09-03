from apps.accounts.models import UserRole
from tests.conftest import api


def test_unauthenticated_cannot_list_students(db):
    res = api().get("/api/v1/students/")
    assert res.status_code in (401, 403)


def test_tenant_isolation_students(district_admin, other_student, student):
    res = api(district_admin).get("/api/v1/students/")
    assert res.status_code == 200
    ids = [row["external_id"] for row in res.data["results"]]
    assert "S-1" in ids
    assert "S-X" not in ids


def test_platform_admin_sees_all(platform_admin, other_student, student):
    res = api(platform_admin).get("/api/v1/students/")
    ids = [row["external_id"] for row in res.data["results"]]
    assert "S-1" in ids and "S-X" in ids


def test_guardian_cannot_list_all_students(linked_guardian, student, other_student):
    res = api(linked_guardian).get("/api/v1/students/")
    assert res.status_code == 403


def test_guardian_children_privacy(linked_guardian, student, other_student):
    res = api(linked_guardian).get("/api/v1/guardian/children/")
    assert res.status_code == 200
    names = [c["first_name"] for c in res.data]
    assert "Ava" in names
    assert "Secret" not in names
    # no home addresses in guardian payload
    assert all("home_address" not in c for c in res.data)


def test_guardian_cannot_open_unlinked_student(linked_guardian, other_student):
    res = api(linked_guardian).get(f"/api/v1/students/{other_student.id}/")
    assert res.status_code in (403, 404)


def test_driver_only_own_trips(driver_user, district, school, depot):
    from datetime import date, timedelta

    from apps.operations.models import Trip
    from apps.routing.models import Route, RoutePlan
    from apps.transportation.models import DriverProfile, Vehicle

    plan = RoutePlan.objects.create(district=district, name="p", school=school, status="published")
    v = Vehicle.objects.create(district=district, internal_number="B1", license_plate="x", capacity=40, depot=depot)
    route = Route.objects.create(
        route_plan=plan, name="r", route_code="R1", school=school, depot=depot, assigned_vehicle=v
    )
    route2 = Route.objects.create(
        route_plan=plan, name="r2", route_code="R2", school=school, depot=depot, assigned_vehicle=v
    )
    mine = DriverProfile.objects.get(user=driver_user)
    other_u = driver_user.__class__.objects.create_user(
        email="otherdriver@jefferson.demo",
        password="DemoPass123!",
        first_name="O",
        last_name="D",
        role=UserRole.DRIVER,
        district=district,
    )
    other = DriverProfile.objects.create(user=other_u, district=district, employee_id="D-999")
    t1 = Trip.objects.create(district=district, route=route, service_date=date.today(), driver=mine, vehicle=v)
    t2 = Trip.objects.create(
        district=district,
        route=route2,
        service_date=date.today(),
        driver=other,
        vehicle=v,
    )
    res = api(driver_user).get("/api/v1/trips/")
    assert res.status_code == 200
    ids = [row["id"] for row in res.data["results"]]
    assert str(t1.id) in ids
    assert str(t2.id) not in ids
