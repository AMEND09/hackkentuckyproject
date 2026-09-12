"""Load the downloaded Louisville Metro / LOJIC open-data CSV/GeoJSON exports.

Idempotent: every row is keyed by a stable source id and upserted, so re-running
after a fresh download just refreshes values. Run after `python manage.py
migrate`:

    python manage.py import_louisville_open_data
    python manage.py import_louisville_open_data --dir /path/to/other/export

Source: see sample_data/louisville_open_data/ (data.louisvilleky.gov / LOJIC
ArcGIS Hub). No TARC feeds here by design — see apps.geodata docs.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from dateutil import parser as dateparser
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.geodata import services as geo_services
from apps.geodata.models import (
    ConstructionPermit,
    HighInjurySegment,
    MidblockCrossing,
    PublicSchoolSite,
    RoadSegment,
    SnowRoute,
    TrafficSignal,
)

CONTEXT_URBAN_DENSITY = {
    "C1": 0.05,
    "C2R": 0.2,
    "C2C": 0.35,
    "C3": 0.5,
    "C4": 0.65,
    "C5": 0.8,
    "C6": 0.95,
}

CORE_CLASS_CATEGORY = {
    "MAJOR ARTERIAL": 2,
    "MINOR ARTERIAL": 1,
    "PRIMARY COLLECTOR": 0,
    "SECONDARY COLLECTOR": 0,
    "LOCAL": 0,
}


def _f(value, default=None):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _s(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _midpoint(coords: list[list[float]]) -> tuple[float, float]:
    """coords are [lng, lat]. Returns (lat, lng) of the middle vertex."""
    if not coords:
        return (0.0, 0.0)
    mid = coords[len(coords) // 2]
    return (mid[1], mid[0])


def _parse_dt(value):
    value = _s(value)
    if not value:
        return None
    try:
        dt = dateparser.parse(value)
    except (ValueError, OverflowError):
        return None
    if dt and timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_default_timezone())
    return dt


class Command(BaseCommand):
    help = "Import Louisville Metro / LOJIC open-data CSV+GeoJSON exports into the geodata reference tables."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir",
            default=str(settings.REPO_ROOT / "sample_data" / "louisville_open_data"),
            help="Directory containing the downloaded CSV/GeoJSON files.",
        )

    def handle(self, *args, **options):
        base = Path(options["dir"])
        if not base.exists():
            self.stderr.write(self.style.ERROR(f"Directory not found: {base}"))
            return

        counts = {}
        counts["Traffic signals"] = self._import_signals(base / "signalized_intersections.geojson")
        counts["Midblock crossings"] = self._import_crossings(base / "midblock_crossings.geojson")
        counts["Road segments"] = self._import_road_segments(base / "road_context_classifications.geojson")
        counts["High-injury segments"] = self._import_high_injury(base / "high_injury_network.geojson")
        counts["Snow routes"] = self._import_snow_routes(base / "snow_routes.geojson")
        counts["Construction permits (current)"] = self._import_permits_current(
            base / "row_construction_permits_current.csv"
        )
        counts["Construction permits (historical)"] = self._import_permits_historical(
            base / "row_permits_historical.csv"
        )
        counts["Public school sites"] = self._import_schools(base / "jcps_schools.geojson")

        geo_services.clear_cache()

        self.stdout.write(self.style.SUCCESS("Louisville open-data import complete:"))
        for label, n in counts.items():
            self.stdout.write(f"  {label}: {n}")

    def _load_geojson(self, path: Path) -> list[dict]:
        if not path.exists():
            self.stderr.write(self.style.WARNING(f"Missing file, skipping: {path}"))
            return []
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        return data.get("features", [])

    def _import_signals(self, path: Path) -> int:
        n = 0
        for feat in self._load_geojson(path):
            props = feat["properties"]
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates")
            if not coords:
                continue
            lng, lat = coords[0], coords[1]
            source_id = str(props.get("SIGID") or props.get("OBJECTID"))
            TrafficSignal.objects.update_or_create(
                source_id=source_id,
                defaults={
                    "main_street": _s(props.get("MAINSTREET")),
                    "cross_street": _s(props.get("CROSSSTREET")),
                    "owner": _s(props.get("OWNER")),
                    "route": _s(props.get("ROUTE")),
                    "signal_type": _s(props.get("TYPE")),
                    "latitude": lat,
                    "longitude": lng,
                },
            )
            n += 1
        return n

    def _import_crossings(self, path: Path) -> int:
        n = 0
        for feat in self._load_geojson(path):
            props = feat["properties"]
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates")
            if not coords:
                continue
            lng, lat = coords[0], coords[1]
            source_id = str(props.get("OBJECTID"))
            aid_type = _s(props.get("AIDTYPE")).upper()
            MidblockCrossing.objects.update_or_create(
                source_id=source_id,
                defaults={
                    "road_name": _s(props.get("ROADNAME") or props.get("STRNAME")),
                    "cross_street": _s(props.get("CROSSST")),
                    "crossing_type": _s(props.get("CROSSTYPE")),
                    "status": _s(props.get("STATUS")),
                    "has_rrfb_or_signal": any(k in aid_type for k in ("RRFB", "SIGNAL", "HAWK", "PHB")),
                    "near_tarc_stop": _s(props.get("TARC")).upper() in ("Y", "YES", "1", "TRUE"),
                    "latitude": lat,
                    "longitude": lng,
                },
            )
            n += 1
        return n

    def _import_road_segments(self, path: Path) -> int:
        n = 0
        for feat in self._load_geojson(path):
            props = feat["properties"]
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates")
            if not coords:
                continue
            lat, lng = _midpoint(coords)
            core = _s(props.get("CORE_CLASS")).upper()
            context = _s(props.get("CONTEXT_CLASS")).upper()
            source_id = str(props.get("OBJECTID") or props.get("RWCOMPKEY"))
            RoadSegment.objects.update_or_create(
                source_id=source_id,
                defaults={
                    "road_name": _s(props.get("ROADNAME") or props.get("STRNAME")),
                    "core_class": core,
                    "context_class": context,
                    "speed_limit_mph": int(_f(props.get("SPEED"), 0) or 0) or None,
                    "road_category": CORE_CLASS_CATEGORY.get(core, 0),
                    "urban_density": CONTEXT_URBAN_DENSITY.get(context, 0.5),
                    "midpoint_lat": lat,
                    "midpoint_lng": lng,
                    "geometry": coords,
                },
            )
            n += 1
        return n

    def _import_high_injury(self, path: Path) -> int:
        n = 0
        for feat in self._load_geojson(path):
            props = feat["properties"]
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates")
            if not coords:
                continue
            lat, lng = _midpoint(coords)
            source_id = str(props.get("OBJECTID") or props.get("RWCOMPKEY"))
            HighInjurySegment.objects.update_or_create(
                source_id=source_id,
                defaults={
                    "road_name": _s(props.get("ROADNAME") or props.get("STRNAME")),
                    "corridor_name": _s(props.get("CORRIDOR_N")),
                    "core_class": _s(props.get("CORE_CLASS")).upper(),
                    "priority_rank": _f(props.get("PRIORITY_R")),
                    "total_epdo": _f(props.get("TOTAL_EPDO")),
                    "total_ka_crashes": _f(props.get("TOTAL_KA_C")),
                    "length_miles": _f(props.get("LENGTH")),
                    "owner": _s(props.get("OWNER")),
                    "midpoint_lat": lat,
                    "midpoint_lng": lng,
                    "geometry": coords,
                },
            )
            n += 1
        return n

    def _import_snow_routes(self, path: Path) -> int:
        n = 0
        for feat in self._load_geojson(path):
            props = feat["properties"]
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates")
            if not coords:
                continue
            lat, lng = _midpoint(coords)
            source_id = str(props.get("OBJECTID") or props.get("RWCOMPKEY"))
            SnowRoute.objects.update_or_create(
                source_id=source_id,
                defaults={
                    "road_name": _s(props.get("ROADNAME")),
                    "route": _s(props.get("ROUTE")),
                    "response": _s(props.get("RESPONSE")),
                    "priority": _s(props.get("PRIORITY")),
                    "state_owned": _s(props.get("STATE_OWND")).upper() in ("Y", "YES", "1", "TRUE"),
                    "midpoint_lat": lat,
                    "midpoint_lng": lng,
                    "geometry": coords,
                },
            )
            n += 1
        return n

    def _import_permits_current(self, path: Path) -> int:
        if not path.exists():
            self.stderr.write(self.style.WARNING(f"Missing file, skipping: {path}"))
            return 0
        n = 0
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                permit_no = _s(row.get("PERMIT_NO"))
                object_id = _s(row.get("ObjectId"))
                if not permit_no and not object_id:
                    continue
                source_id = f"current-{permit_no or object_id}"
                ConstructionPermit.objects.update_or_create(
                    source_id=source_id,
                    defaults={
                        "source": ConstructionPermit.Source.CURRENT,
                        "permit_no": permit_no,
                        "applicant_name": _s(row.get("APPLICANT_NAME")),
                        "work_type": _s(row.get("WORK_TYPE")),
                        "description": _s(row.get("WORK_DESCRIPTION"))[:4000],
                        "street_address": ", ".join(
                            p for p in (_s(row.get("STREET_ADDRESS")), _s(row.get("CITY"))) if p
                        ),
                        "from_date": _parse_dt(row.get("FROM_DATE")),
                        "to_date": _parse_dt(row.get("TO_DATE")),
                        "latitude": _f(row.get("LATITUDE")),
                        "longitude": _f(row.get("LONGITUDE")),
                    },
                )
                n += 1
        return n

    def _import_permits_historical(self, path: Path) -> int:
        if not path.exists():
            self.stderr.write(self.style.WARNING(f"Missing file, skipping: {path}"))
            return 0
        n = 0
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                apno = _s(row.get("APNO"))
                object_id = _s(row.get("ObjectId"))
                if not apno and not object_id:
                    continue
                source_id = f"historical-{apno or object_id}"
                ConstructionPermit.objects.update_or_create(
                    source_id=source_id,
                    defaults={
                        "source": ConstructionPermit.Source.HISTORICAL,
                        "permit_no": apno,
                        "applicant_name": _s(row.get("FULLNAME")),
                        "work_type": _s(row.get("WORKTYPE_DESCRIPTION") or row.get("WORKTYPE")),
                        "description": _s(row.get("COMMENTS_SEARCH"))[:4000],
                        "street_address": ", ".join(
                            p for p in (_s(row.get("STREET_ADDRESS")), _s(row.get("CITY"))) if p
                        ),
                        "from_date": _parse_dt(row.get("FROM DATE")),
                        "to_date": _parse_dt(row.get("TO DATE")),
                        "latitude": _f(row.get("Latitude")),
                        "longitude": _f(row.get("Longitude")),
                    },
                )
                n += 1
        return n

    def _import_schools(self, path: Path) -> int:
        n = 0
        for feat in self._load_geojson(path):
            props = feat["properties"]
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates")
            if not coords:
                continue
            lng, lat = coords[0], coords[1]
            source_id = str(props.get("OBJECTID"))
            PublicSchoolSite.objects.update_or_create(
                source_id=source_id,
                defaults={
                    "name": _s(props.get("SCH_NAME")) or "Unnamed school",
                    "level": _s(props.get("LEVEL_")),
                    "loc_type": _s(props.get("LOC_TYPE")),
                    "address": _s(props.get("ADDRESS")),
                    "city": _s(props.get("CITY")),
                    "state": _s(props.get("ST")),
                    "zip_code": _s(props.get("ZIP")),
                    "phone": _s(props.get("PHONE")),
                    "abbreviation": _s(props.get("SCH_AB")),
                    "website": _s(props.get("SCH_WEB")),
                    "latitude": lat,
                    "longitude": lng,
                },
            )
            n += 1
        return n
