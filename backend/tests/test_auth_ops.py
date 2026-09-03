from datetime import date

from apps.imports.services.mapper import HeuristicColumnMapper
from apps.operations.models import GPSPosition, OperationalAlert, Trip
from apps.operations.services.lifecycle import ingest_gps, refresh_trip_eta
from apps.routing.models import Route, RoutePlan
from apps.transportation.models import Vehicle
from common.utilities.geo import haversine_km
from tests.conftest import api


def test_login_and_me(district_admin):
    res = api().post(
        "/api/v1/auth/login/",
        {"email": "admin@jefferson.demo", "password": "DemoPass123!"},
        format="json",
    )
    assert res.status_code == 200
    assert "access" in res.data["tokens"]
    token = res.data["tokens"]["access"]
    client = api()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    me = client.get("/api/v1/auth/me/")
    assert me.data["email"] == "admin@jefferson.demo"


def test_column_mapper_aliases():
    mapper = HeuristicColumnMapper()
    proposed = mapper.propose(
        "students",
        ["StudentID", "First", "Last Name", "School", "Lat", "Lng", "Grade"],
        [{"StudentID": "1", "First": "Ava", "Last Name": "B", "School": "OAK", "Lat": "38.2", "Lng": "-85.7", "Grade": "2"}],
    )
    mapping = proposed["mapping"]
    assert mapping["student_id"]["header"]
    assert mapping["first_name"]["header"]
    assert mapping["latitude"]["header"]


def test_ml_fallback_without_models(db):
    from apps.machine_learning.services.predict import predict_segment

    out = predict_segment({"planned_duration_s": 100, "distance_km": 1.2})
    assert out["fallback"] is True
    assert out["p50_s"] == 100


def test_trip_gps_creates_alert(district, school, depot, dispatcher):
    plan = RoutePlan.objects.create(district=district, name="p", school=school, status="published")
    v = Vehicle.objects.create(district=district, internal_number="B9", license_plate="z", capacity=40, depot=depot)
    route = Route.objects.create(
        route_plan=plan,
        name="r",
        route_code="R9",
        school=school,
        depot=depot,
        assigned_vehicle=v,
        p50_duration_seconds=1200,
        p90_duration_seconds=1500,
    )
    trip = Trip.objects.create(district=district, route=route, service_date=date.today(), vehicle=v, status="active")
    trip.current_delay_seconds = 0
    ingest_gps(trip, 38.24, -85.73, speed=4, is_simulated=True)
    # force delay threshold
    refresh_trip_eta(trip, extra_delay_s=600)
    assert OperationalAlert.objects.filter(trip=trip, alert_type="predicted_delay").exists()
    assert GPSPosition.objects.filter(trip=trip, is_simulated=True).exists()


def test_haversine_positive():
    d = haversine_km(38.24, -85.73, 38.25, -85.74)
    assert 0.5 < d < 3


def test_bearing_and_guidance():
    from common.utilities.geo import bearing_degrees, cardinal_from_bearing

    heading = bearing_degrees(38.24, -85.76, 38.26, -85.76)
    assert 0 <= heading < 20
    assert cardinal_from_bearing(0) == "north"
    assert cardinal_from_bearing(90) == "east"
