"""Heuristic CSV column mapper.

Implements ColumnMapper so an LLM mapper can be swapped in later without
changing the import views. No external LLM is required.
"""

from __future__ import annotations

import csv
import io
import re
from difflib import SequenceMatcher
from typing import Protocol

from rapidfuzz import fuzz

CANONICAL = {
    "schools": {
        "school_id": ["school_id", "id", "school_code", "code", "sch_id"],
        "name": ["name", "school_name", "school"],
        "school_type": ["school_type", "type", "level", "grade_span"],
        "address": ["address", "street", "location"],
        "latitude": ["latitude", "lat", "y"],
        "longitude": ["longitude", "lng", "lon", "long", "x"],
        "morning_bell": ["morning_bell", "bell", "am_bell", "start_time"],
        "dismissal": ["dismissal", "pm_bell", "end_time", "dismissal_time"],
        "is_active": ["is_active", "active", "status"],
    },
    "students": {
        "student_id": ["student_id", "id", "external_id", "sis_id", "studentid"],
        "first_name": ["first_name", "firstname", "first", "given_name"],
        "last_name": ["last_name", "lastname", "last", "surname", "family_name"],
        "grade": ["grade", "grade_level", "year"],
        "school_id": ["school_id", "school_code", "school", "campus"],
        "home_address": ["home_address", "address", "street_address"],
        "latitude": ["latitude", "lat", "home_lat"],
        "longitude": ["longitude", "lng", "lon", "home_lng"],
        "eligible": ["eligible", "eligibility", "transportation_eligible"],
        "wheelchair": ["wheelchair", "requires_wheelchair", "ada", "wc"],
        "max_ride_minutes": ["max_ride_minutes", "max_ride", "ride_time_cap"],
    },
    "drivers": {
        "employee_id": ["employee_id", "id", "emp_id", "driver_id"],
        "email": ["email", "e_mail"],
        "first_name": ["first_name", "firstname", "first"],
        "last_name": ["last_name", "lastname", "last"],
        "phone": ["phone", "mobile", "cell"],
        "license_expiration": ["license_expiration", "cdl_exp", "license_exp"],
        "endorsements": ["endorsements", "certs"],
        "availability": ["availability", "shift"],
    },
    "vehicles": {
        "vehicle_number": ["vehicle_number", "bus_number", "internal_number", "unit", "id"],
        "license_plate": ["license_plate", "plate", "tag"],
        "capacity": ["capacity", "seats", "pax"],
        "wheelchair_capacity": ["wheelchair_capacity", "wc_capacity", "ada_seats"],
        "vehicle_type": ["vehicle_type", "type"],
        "status": ["status"],
        "depot_name": ["depot_name", "depot", "yard"],
    },
    "stops": {
        "stop_id": ["stop_id", "id", "stop_code", "code"],
        "name": ["name", "stop_name"],
        "address": ["address", "location"],
        "latitude": ["latitude", "lat"],
        "longitude": ["longitude", "lng", "lon"],
        "approved": ["approved", "is_approved", "status"],
        "accessibility": ["accessibility", "ada"],
        "safety_notes": ["safety_notes", "notes"],
    },
}

REQUIRED = {
    "schools": ["school_id", "name", "latitude", "longitude"],
    "students": ["student_id", "first_name", "last_name", "school_id", "latitude", "longitude"],
    "drivers": ["employee_id", "email", "first_name", "last_name"],
    "vehicles": ["vehicle_number", "capacity"],
    "stops": ["stop_id", "name", "latitude", "longitude"],
}


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")


class ColumnMapper(Protocol):
    def propose(self, import_type: str, headers: list[str], sample_rows: list[dict]) -> dict: ...


class HeuristicColumnMapper:
    def propose(self, import_type: str, headers: list[str], sample_rows: list[dict]) -> dict:
        schema = CANONICAL[import_type]
        mapping = {}
        used = set()
        examples = {}
        for canonical, aliases in schema.items():
            best_header = None
            best_score = 0
            for header in headers:
                n = _norm(header)
                score = 0
                if n in {_norm(a) for a in aliases} or n == canonical:
                    score = 100
                else:
                    score = max(fuzz.ratio(n, _norm(a)) for a in aliases + [canonical])
                    score = max(score, int(SequenceMatcher(None, n, canonical).ratio() * 100))
                if score > best_score and header not in used:
                    best_score = score
                    best_header = header
            if best_header and best_score >= 70:
                mapping[canonical] = {"header": best_header, "confidence": best_score / 100}
                used.add(best_header)
                examples[canonical] = [
                    row.get(best_header, "") for row in sample_rows[:3] if isinstance(row, dict)
                ]
            else:
                mapping[canonical] = {"header": None, "confidence": 0}
                examples[canonical] = []
        missing = [f for f in REQUIRED[import_type] if not mapping[f]["header"]]
        unmapped = [h for h in headers if h not in used]
        return {
            "mapping": mapping,
            "examples": examples,
            "missing_required": missing,
            "unmapped_headers": unmapped,
            "mapper": "heuristic",
        }


def get_column_mapper() -> ColumnMapper:
    return HeuristicColumnMapper()


IMPORT_ORDER = ("schools", "stops", "students", "vehicles", "drivers")


def detect_import_type(headers: list[str], filename: str = "") -> str:
    """Guess schools / students / stops / vehicles / drivers from the file name or columns."""
    stem = _norm(filename.rsplit("/", 1)[-1].rsplit(".", 1)[0])
    for kind in IMPORT_ORDER:
        singular = kind[:-1] if kind.endswith("s") else kind
        if stem in {kind, singular} or stem.endswith(f"_{kind}") or stem.endswith(f"_{singular}"):
            return kind
        if stem.startswith(f"{kind}_") or stem.startswith(f"{singular}_"):
            return kind
    mapper = HeuristicColumnMapper()
    best, best_score = "students", -1
    for kind in IMPORT_ORDER:
        proposal = mapper.propose(kind, headers, [])
        mapped = sum(1 for field in REQUIRED[kind] if proposal["mapping"][field]["header"])
        extra = sum(1 for field, val in proposal["mapping"].items() if val.get("header"))
        score = mapped * 10 + extra
        if mapped == len(REQUIRED[kind]) and score > best_score:
            best, best_score = kind, score
        elif mapped >= 2 and score > best_score:
            best, best_score = kind, score
    return best


def read_csv_bytes(data: bytes) -> tuple[list[str], list[dict]]:
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = list(reader)
    return headers, rows
