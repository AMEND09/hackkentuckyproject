from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import GuardianStudentLink, User, UserRole
from apps.audit.models import AuditLog
from apps.districts.models import Depot, District, DistrictPolicy, School
from apps.notifications.models import Notification
from apps.operations.models import GPSPosition, Incident, OperationalAlert, Trip
from apps.routing.models import RoutePlan
from apps.transportation.models import BusStop, DriverProfile, Student, StudentStopAssignment, Vehicle
from common.utilities.geo import haversine_km

FIRST = [
    "Ava", "Leo", "Mia", "Owen", "Zoe", "Eli", "Nora", "Kai", "Lila", "Theo",
    "Ruby", "Jonah", "Ivy", "Asher", "Quinn", "Piper", "Nina", "Omar", "Sage", "Hugo",
    "Chloe", "Miles", "Elena", "Felix", "Imani", "Jules", "Keira", "Luca", "Mira", "Nico",
]
LAST = [
    "Bennett", "Kim", "Santos", "Clark", "Nguyen", "Patel", "Walsh", "Brooks", "Ortiz", "Grant",
    "Shah", "Reed", "Morales", "Cole", "Diaz", "Hughes", "Park", "Rossi", "Khan", "Owens",
]


def _claim(student) -> str:
    prefix = (student.first_name or "XXX")[:3].upper().ljust(3, "X")
    digits = "".join(ch for ch in (student.external_id or "") if ch.isdigit())[-3:].zfill(3)
    return f"{prefix}{digits}"


class Command(BaseCommand):
    help = "Seed the fictional Jefferson Demo Schools district and demo users."

    def add_arguments(self, parser):
        parser.add_argument("--skip-if-exists", action="store_true")
        parser.add_argument("--reset-demo", action="store_true")

    def handle(self, *args, **options):
        rng = random.Random(42)
        exists = District.objects.filter(slug="jefferson-demo").exists()
        if options["reset_demo"]:
            District.objects.filter(slug="jefferson-demo").delete()
            User.objects.filter(email__endswith="@jefferson.demo").delete()
            User.objects.filter(email=settings.DEMO_PLATFORM_EMAIL).delete()
            exists = False

        if options["skip_if_exists"] and exists:
            self.stdout.write("Demo district already exists; refreshing live trips and missing school plans.")
            district = District.objects.get(slug="jefferson-demo")
            self._users(district)
            schools = list(district.schools.order_by("school_code"))
            if not schools:
                schools = self._schools(district)
            self._depots(district)
            self._vehicles(district, list(district.depots.order_by("name")))
            self._drivers(district)
            students = list(district.students.order_by("external_id"))
            if students:
                self._guardians(district, students, rng)
            self._ensure_plans_and_ops(district, schools, rng)
            self.stdout.write(self.style.SUCCESS(f"Refreshed live demo data for {district.name}."))
            return

        district = self._district()
        self._users(district)
        schools = self._schools(district)
        depots = self._depots(district)
        self._vehicles(district, depots)
        self._drivers(district)
        stops = self._stops(district, schools, rng)
        students = self._students(district, schools, stops, rng)
        self._assign_stops(students, stops)
        self._guardians(district, students, rng)
        self._ensure_plans_and_ops(district, schools, rng)
        self.stdout.write(self.style.SUCCESS(f"Seeded {district.name} with {len(students)} fictional students."))

    def _ensure_plans_and_ops(self, district, schools, rng):
        planner = User.objects.filter(email=settings.DEMO_PLANNER_EMAIL).first()
        specs = [
            (schools[0], RoutePlan.Mode.FASTEST, "Oakridge AM — Fastest", False),
            (schools[0], RoutePlan.Mode.RELIABILITY, "Oakridge AM — Reliability", True),
            (schools[1], RoutePlan.Mode.FASTEST, "Riverside AM — Fastest", False),
            (schools[1], RoutePlan.Mode.RELIABILITY, "Riverside AM — Reliability", True),
            (schools[2], RoutePlan.Mode.RELIABILITY, "Highland AM — Reliability", True),
        ]
        all_trips = []
        for school, mode, name, publish in specs:
            plan, created = RoutePlan.objects.get_or_create(
                district=district,
                name=name,
                defaults={
                    "school": school,
                    "optimization_mode": mode,
                    "status": RoutePlan.Status.DRAFT,
                    "created_by": planner,
                },
            )
            if plan.school_id != school.id:
                plan.school = school
                plan.optimization_mode = mode
                plan.save(update_fields=["school", "optimization_mode"])
            try:
                from apps.routing.services.optimizer import generate_plan

                if created or not plan.routes.exists():
                    generate_plan(plan)
                    self.stdout.write(f"Generated {name} ({plan.routes.count()} routes).")
                if publish:
                    plan.status = RoutePlan.Status.PUBLISHED
                    plan.save(update_fields=["status"])
                    from apps.operations.services.lifecycle import materialize_trips_for_plan

                    all_trips.extend(materialize_trips_for_plan(plan))
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"Optimizer skipped for {name}: {exc}"))
        self._ops_history(all_trips, rng)
        self._audit_and_notes(district)

    def _district(self) -> District:
        district, _ = District.objects.get_or_create(
            slug="jefferson-demo",
            defaults={
                "name": "Jefferson Demo Schools",
                "state": "KY",
                "timezone": "America/Kentucky/Louisville",
                "contact_email": "transport@jefferson.demo",
                "contact_phone": "502-555-0100",
            },
        )
        DistrictPolicy.objects.get_or_create(
            district=district,
            defaults={
                "max_walking_distance_m": {"elementary": 400, "middle": 600, "high": 800},
                "max_student_ride_minutes": 50,
                "min_arrival_buffer_minutes": 10,
                "default_boarding_seconds": 18,
                "wheelchair_boarding_seconds": 90,
                "allowable_early_minutes": 25,
                "allowable_late_minutes": 0,
                "reliability_target": 0.9,
            },
        )
        return district

    def _users(self, district):
        pw = settings.DEMO_PASSWORD
        specs = [
            (settings.DEMO_PLATFORM_EMAIL, "Riley", "Admin", UserRole.PLATFORM_ADMIN, None, True),
            (settings.DEMO_DISTRICT_ADMIN_EMAIL, "Jordan", "Hale", UserRole.DISTRICT_ADMIN, district, True),
            (settings.DEMO_PLANNER_EMAIL, "Sam", "Okoye", UserRole.PLANNER, district, False),
            (settings.DEMO_DISPATCHER_EMAIL, "Casey", "Nguyen", UserRole.DISPATCHER, district, False),
            (settings.DEMO_DRIVER_EMAIL, "Maya", "Chen", UserRole.DRIVER, district, False),
            (settings.DEMO_GUARDIAN_EMAIL, "Alex", "Bennett", UserRole.GUARDIAN, district, False),
            (settings.DEMO_STUDENT_EMAIL, "Mia", "Santos", UserRole.GUARDIAN, district, False),
        ]
        for email, first, last, role, dist, staff in specs:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "role": role,
                    "district": dist,
                    "is_staff": staff,
                    "is_superuser": role == UserRole.PLATFORM_ADMIN,
                    "phone": "502-555-0199",
                },
            )
            user.set_password(pw)
            user.save()

    def _schools(self, district):
        rows = [
            ("OAK-ES", "Oakridge Elementary", School.SchoolType.ELEMENTARY, "4100 Oakridge Ave", 38.2412, -85.7245, time(8, 15), time(14, 45)),
            ("RIV-MS", "Riverside Middle", School.SchoolType.MIDDLE, "220 River Rd", 38.2680, -85.7610, time(8, 0), time(15, 0)),
            ("HIG-HS", "Highland Academy", School.SchoolType.HIGH, "1800 Highland Pkwy", 38.2290, -85.6920, time(7, 45), time(14, 30)),
        ]
        schools = []
        for code, name, stype, addr, lat, lng, bell, diss in rows:
            s, _ = School.objects.update_or_create(
                district=district,
                school_code=code,
                defaults={
                    "name": name,
                    "school_type": stype,
                    "address": f"{addr}, Louisville KY",
                    "latitude": lat,
                    "longitude": lng,
                    "morning_bell_time": bell,
                    "dismissal_time": diss,
                },
            )
            schools.append(s)
        return schools

    def _depots(self, district):
        data = [
            ("Central Transportation Yard", "900 Industry Rd, Louisville KY", 38.2150, -85.7400),
            ("East Annex Yard", "6400 Shelbyville Rd, Louisville KY", 38.2450, -85.6500),
        ]
        out = []
        for name, addr, lat, lng in data:
            d, _ = Depot.objects.update_or_create(
                district=district, name=name, defaults={"address": addr, "latitude": lat, "longitude": lng}
            )
            out.append(d)
        return out

    def _vehicles(self, district, depots):
        specs = [
            ("BUS-01", 72, 0, depots[0], "active"),
            ("BUS-02", 72, 0, depots[0], "active"),
            ("BUS-03", 48, 2, depots[0], "active"),
            ("BUS-04", 72, 0, depots[0], "active"),
            ("BUS-05", 48, 2, depots[1], "active"),
            ("BUS-06", 72, 0, depots[0], "active"),
            ("BUS-07", 54, 1, depots[1], "active"),
            ("BUS-08", 72, 0, depots[0], "spare"),
            ("BUS-09", 72, 0, depots[1], "active"),
            ("BUS-10", 48, 2, depots[0], "active"),
            ("BUS-11", 72, 0, depots[1], "active"),
            ("BUS-12", 54, 1, depots[0], "maintenance"),
        ]
        out = []
        for num, cap, wc, depot, status in specs:
            v, _ = Vehicle.objects.update_or_create(
                district=district,
                internal_number=num,
                defaults={
                    "license_plate": f"KY-RW-{num[-2:]}",
                    "capacity": cap,
                    "wheelchair_capacity": wc,
                    "vehicle_type": "accessible" if wc else "standard",
                    "status": status,
                    "depot": depot,
                },
            )
            out.append(v)
        return out

    def _drivers(self, district):
        demo = User.objects.get(email=settings.DEMO_DRIVER_EMAIL)
        names = [
            (demo, "D-1001"),
            ("Jordan Ellis", "D-1002"),
            ("Priya Nair", "D-1003"),
            ("Luis Mora", "D-1004"),
            ("Aisha Brooks", "D-1005"),
            ("Noah Patel", "D-1006"),
            ("Elena Vasquez", "D-1007"),
            ("Caleb Nguyen", "D-1008"),
            ("Sofia Harris", "D-1009"),
            ("Marcus Owens", "D-1010"),
        ]
        out = []
        for item, emp in names:
            if isinstance(item, User):
                user = item
            else:
                first, last = item.split(" ", 1)
                email = f"{first.lower()}.{last.lower().replace(' ', '')}@jefferson.demo"
                user, _ = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "first_name": first,
                        "last_name": last,
                        "role": UserRole.DRIVER,
                        "district": district,
                    },
                )
                if not user.has_usable_password() or True:
                    user.set_password(settings.DEMO_PASSWORD)
                    user.save()
            prof, _ = DriverProfile.objects.update_or_create(
                district=district,
                employee_id=emp,
                defaults={
                    "user": user,
                    "license_expiration": date(2027, 6, 30),
                    "endorsements": ["CDL-B", "S", "P"],
                    "is_active": True,
                },
            )
            out.append(prof)
        return out

    def _stops(self, district, schools, rng):
        stops = []
        n = 0
        for school in schools:
            count = 12 if school.school_type == School.SchoolType.ELEMENTARY else 10
            for i in range(count):
                n += 1
                lat = float(school.latitude) + rng.uniform(-0.028, 0.028)
                lng = float(school.longitude) + rng.uniform(-0.032, 0.032)
                code = f"ST-{school.school_code}-{i+1}"
                stop, _ = BusStop.objects.update_or_create(
                    district=district,
                    stop_code=code,
                    defaults={
                        "name": f"{school.name.split()[0]} Stop {i+1}",
                        "address": f"{400 + n} Fictional Way, Louisville KY",
                        "latitude": round(lat, 6),
                        "longitude": round(lng, 6),
                        "is_approved": True,
                        "accessibility": "curb_cut" if i % 3 == 0 else "none",
                    },
                )
                stops.append(stop)
        return stops

    def _students(self, district, schools, stops, rng):
        students = []
        n = 0
        targets = {schools[0].id: 50, schools[1].id: 42, schools[2].id: 38}
        for school in schools:
            for i in range(targets[school.id]):
                n += 1
                lat = float(school.latitude) + rng.uniform(-0.03, 0.03)
                lng = float(school.longitude) + rng.uniform(-0.034, 0.034)
                wc = n in {3, 18, 55, 90}
                st, _ = Student.objects.update_or_create(
                    district=district,
                    external_id=f"S-{10000 + n}",
                    defaults={
                        "first_name": FIRST[n % len(FIRST)],
                        "last_name": LAST[n % len(LAST)],
                        "grade": str(rng.randint(1, 5 if school.school_type == "elementary" else 8 if school.school_type == "middle" else 12)),
                        "school": school,
                        "home_address": f"{100 + n} Imaginary Ln, Louisville KY",
                        "latitude": round(lat, 6),
                        "longitude": round(lng, 6),
                        "eligibility": Student.Eligibility.ELIGIBLE,
                        "requires_wheelchair": wc,
                    },
                )
                students.append(st)
        return students

    def _assign_stops(self, students, stops):
        for student in students:
            school_stops = [s for s in stops if student.school.school_code in s.stop_code]
            if not school_stops:
                school_stops = stops
            nearest = min(
                school_stops,
                key=lambda s: haversine_km(student.latitude, student.longitude, s.latitude, s.longitude),
            )
            dist = haversine_km(student.latitude, student.longitude, nearest.latitude, nearest.longitude)
            StudentStopAssignment.objects.update_or_create(
                student=student,
                bus_stop=nearest,
                direction=StudentStopAssignment.Direction.AM,
                defaults={"walking_distance_m": int(dist * 1000), "is_active": True},
            )

    def _guardians(self, district, students, rng):
        guser = User.objects.get(email=settings.DEMO_GUARDIAN_EMAIL)
        # Demo family sees two riders so Today/Track match the DART screens.
        for student in students[:2]:
            GuardianStudentLink.objects.update_or_create(
                guardian=guser,
                student=student,
                defaults={"relationship": "parent", "is_verified": True, "notification_preferences": {"eta": True, "delay": True, "school": False}},
            )
        # Self-guardian: a student account linked to their own Student record.
        if len(students) > 2:
            rider = students[2]
            suser, _ = User.objects.get_or_create(
                email=settings.DEMO_STUDENT_EMAIL,
                defaults={
                    "first_name": rider.first_name,
                    "last_name": rider.last_name,
                    "role": UserRole.GUARDIAN,
                    "district": district,
                },
            )
            suser.set_password(settings.DEMO_PASSWORD)
            suser.save()
            GuardianStudentLink.objects.update_or_create(
                guardian=suser,
                student=rider,
                defaults={"relationship": "self", "is_verified": True, "notification_preferences": {"eta": True, "delay": True}},
            )
            self.stdout.write(f"  Student self-view: {settings.DEMO_STUDENT_EMAIL} → {rider.first_name} (code {_claim(rider)})")
        self.stdout.write(f"  Guardian rider codes: {', '.join(_claim(s) for s in students[:3])}")
        # a few extra fictional guardians
        for i, student in enumerate(students[3:9], start=2):
            email = f"guardian{i}@jefferson.demo"
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": student.last_name,
                    "last_name": "Family",
                    "role": UserRole.GUARDIAN,
                    "district": district,
                },
            )
            user.set_password(settings.DEMO_PASSWORD)
            user.save()
            GuardianStudentLink.objects.update_or_create(
                guardian=user,
                student=student,
                defaults={"relationship": "parent", "is_verified": True},
            )

    def _ops_history(self, trips, rng):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        unique = []
        seen = set()
        for trip in trips:
            if trip.id in seen:
                continue
            seen.add(trip.id)
            unique.append(trip)
        trips = unique
        if not trips:
            return
        drivers = list(DriverProfile.objects.filter(district=trips[0].district, is_active=True).select_related("user"))
        demo_driver = DriverProfile.objects.filter(user__email=settings.DEMO_DRIVER_EMAIL).first()
        dispatcher = User.objects.filter(email=settings.DEMO_DISPATCHER_EMAIL).first()
        live_specs = [
            {"t": 0.28, "delay": 360, "late": 0.62, "status": Trip.Status.ACTIVE, "minutes_ago": 14},
            {"t": 0.12, "delay": 40, "late": 0.11, "status": Trip.Status.ACTIVE, "minutes_ago": 8},
            {"t": 0.55, "delay": 480, "late": 0.78, "status": Trip.Status.ACTIVE, "minutes_ago": 22},
            {"t": 0.08, "delay": 0, "late": 0.08, "status": Trip.Status.ACTIVE, "minutes_ago": 5},
            {"t": 0.40, "delay": 180, "late": 0.41, "status": Trip.Status.ACTIVE, "minutes_ago": 16},
        ]
        for i, trip in enumerate(trips):
            if demo_driver and i == 0:
                trip.driver = demo_driver
            elif drivers:
                trip.driver = drivers[i % len(drivers)]
            spec = live_specs[i] if i < len(live_specs) else None
            if spec:
                trip.status = spec["status"]
                trip.actual_start = timezone.now() - timedelta(minutes=spec["minutes_ago"])
                trip.current_delay_seconds = spec["delay"]
                trip.late_probability = spec["late"]
                trip.is_simulated = True
                trip.ml_explanation = (
                    "Synthetic delay model: boarding dwell and corridor traffic put this bus behind P50 pace."
                    if spec["late"] >= 0.4
                    else "The bus is near its planned pace. Remaining risk is mainly boarding variation."
                )
                trip.save()
                self._place_bus(trip, spec["t"])
            else:
                trip.status = Trip.Status.SCHEDULED
                trip.save(update_fields=["driver", "status"])
            if i < 3:
                Trip.objects.update_or_create(
                    district=trip.district,
                    route=trip.route,
                    service_date=yesterday,
                    defaults={
                        "driver": trip.driver,
                        "vehicle": trip.vehicle,
                        "status": Trip.Status.COMPLETED,
                        "actual_start": timezone.make_aware(datetime.combine(yesterday, time(7, 10))),
                        "actual_completion": timezone.make_aware(datetime.combine(yesterday, time(8, 5))),
                        "current_delay_seconds": rng.choice([0, 60, 120, 240]),
                    },
                )

        live = trips[0]
        self._open_alert(
            live,
            "predicted_delay",
            f"Predicted delay on {live.route.route_code}",
            "Synthetic ML indicates a late school arrival if traffic holds.",
            OperationalAlert.Severity.WARNING,
            0.62,
        )
        if len(trips) > 2:
            hot = trips[2]
            self._open_alert(
                hot,
                "predicted_delay",
                f"At-risk arrival {hot.route.route_code}",
                "Boarding variance plus a fictional corridor slowdown. Dispatcher should watch this bus.",
                OperationalAlert.Severity.CRITICAL,
                0.78,
            )
        OperationalAlert.objects.get_or_create(
            district=live.district,
            alert_type="weather",
            title="Light rain on the east loop",
            defaults={
                "trip": None,
                "message": "Synthetic weather overlay: expect slightly longer dwell at curb stops.",
                "severity": OperationalAlert.Severity.INFO,
                "probability": 0.3,
            },
        )
        Incident.objects.get_or_create(
            trip=live,
            type=Incident.Type.TRAFFIC,
            defaults={
                "severity": Incident.Severity.MEDIUM,
                "description": "Queueing on a fictional arterial (demo).",
                "created_by": dispatcher,
            },
        )
        if len(trips) > 2:
            Incident.objects.get_or_create(
                trip=trips[2],
                type=Incident.Type.WEATHER,
                defaults={
                    "severity": Incident.Severity.LOW,
                    "description": "Wet pavement on a fictional neighborhood loop.",
                    "created_by": dispatcher,
                },
            )

    def _open_alert(self, trip, alert_type, title, message, severity, probability):
        existing = OperationalAlert.objects.filter(trip=trip, alert_type=alert_type).first()
        if existing:
            existing.title = title
            existing.message = message
            existing.severity = severity
            existing.probability = probability
            existing.is_acknowledged = False
            existing.save()
            return existing
        return OperationalAlert.objects.create(
            district=trip.district,
            trip=trip,
            alert_type=alert_type,
            title=title,
            message=message,
            severity=severity,
            probability=probability,
        )

    def _place_bus(self, trip, t: float):
        from apps.routing.services.street_router import interpolate_along, passed_stop_sequence, route_geometry

        geo = route_geometry(trip.route, fetch=True)
        coords = geo.get("coordinates") or []
        if len(coords) < 2:
            return
        trip.positions.filter(is_simulated=True).delete()
        lat, lng, heading, along = interpolate_along(coords, t)
        GPSPosition.objects.create(
            trip=trip,
            timestamp=timezone.now(),
            latitude=round(lat, 6),
            longitude=round(lng, 6),
            heading=heading,
            speed_kmh=32,
            is_simulated=True,
        )
        trip.current_stop_sequence = passed_stop_sequence(trip.route, along, coords)
        trip.save(update_fields=["current_stop_sequence"])

    def _audit_and_notes(self, district):
        planner = User.objects.filter(email=settings.DEMO_PLANNER_EMAIL).first()
        admin = User.objects.filter(email=settings.DEMO_DISTRICT_ADMIN_EMAIL).first()
        dispatcher = User.objects.filter(email=settings.DEMO_DISPATCHER_EMAIL).first()
        guardian = User.objects.filter(email=settings.DEMO_GUARDIAN_EMAIL).first()
        rows = [
            (planner, "published_plan", "route_plan", "Oakridge AM — Reliability"),
            (planner, "published_plan", "route_plan", "Riverside AM — Reliability"),
            (admin, "updated_policy", "district_policy", str(district.id)),
            (dispatcher, "acknowledged_nothing", "operational_alert", "seed"),
            (dispatcher, "viewed_dispatcher_console", "trip", "today"),
        ]
        if AuditLog.objects.filter(district=district).count() < 5:
            for actor, action, rtype, rid in rows:
                AuditLog.objects.create(
                    actor=actor, action=action, resource_type=rtype, resource_id=rid, district=district, metadata={"seed": True}
                )
        if guardian and Notification.objects.filter(user=guardian).count() < 3:
            Notification.objects.filter(user=guardian, event_type="trip.eta.updated").delete()
            for title, body, event, payload, read in (
                (
                    "Route is running late",
                    "About 6 minutes behind. Pickup is later than the scheduled time. This is a synthetic demo notification.",
                    "trip.delay",
                    {"kind": "delay"},
                    False,
                ),
                (
                    "Bus has departed the depot",
                    "Your rider's morning run is underway. Arrival estimates will update as the bus moves.",
                    "trip.started",
                    {},
                    False,
                ),
                (
                    "Afternoon route unchanged",
                    "Drop-off is planned for the usual stop this afternoon.",
                    "route.notice",
                    {},
                    True,
                ),
            ):
                Notification.objects.get_or_create(
                    user=guardian,
                    title=title,
                    defaults={
                        "district": district,
                        "body": body,
                        "event_type": event,
                        "payload": payload,
                        "is_read": read,
                    },
                )
        if dispatcher and not Notification.objects.filter(user=dispatcher, event_type="alert.created").exists():
            Notification.objects.create(
                district=district,
                user=dispatcher,
                title="At-risk routes this morning",
                body="Two fictional routes are behind P50 pace. Open the dispatcher console to follow them.",
                event_type="alert.created",
                payload={},
            )
