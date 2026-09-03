import math

CARDINALS = (
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
)


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dphi = math.radians(float(lat2) - float(lat1))
    dlmb = math.radians(float(lon2) - float(lon1))
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bearing_degrees(lat1, lon1, lat2, lon2) -> float:
    """Initial compass bearing from point A to B, 0–360 clockwise from north."""
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dlmb = math.radians(float(lon2) - float(lon1))
    x = math.sin(dlmb) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dlmb)
    deg = math.degrees(math.atan2(x, y))
    return (deg + 360.0) % 360.0


def cardinal_from_bearing(deg: float) -> str:
    idx = int((float(deg) + 22.5) // 45) % 8
    return CARDINALS[idx]


def safe_filename(name: str) -> str:
    keep = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in (name or "upload"))
    return keep[:180] or "upload.csv"
