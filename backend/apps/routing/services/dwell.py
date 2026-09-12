"""Dwell-time estimation from operational stop-event history.

Fresh installs (and the demo seed) have no stop events, so estimation falls
back to DistrictPolicy constants. Once drivers log arrive/depart scans, the
median observed seconds-per-boarding takes over automatically.

StopEvent does not record wheelchair boardings yet, so the wheelchair premium
stays on the policy value — see the docstring note below.
"""

from __future__ import annotations

import statistics

MIN_SAMPLES = 10
MAX_SAMPLES = 2000


def estimate_boarding_params(district, default_per: int = 20, default_wc: int = 90) -> dict:
    from apps.districts.models import DistrictPolicy
    from apps.operations.models import StopEvent

    policy = DistrictPolicy.objects.filter(district=district).first()
    per = policy.default_boarding_seconds if policy else default_per
    wc = policy.wheelchair_boarding_seconds if policy else default_wc

    events = (
        StopEvent.objects.filter(
            trip__district=district,
            arrival_time__isnull=False,
            departure_time__isnull=False,
            boarded_count__gt=0,
        )
        .order_by("-arrival_time")
        .values("arrival_time", "departure_time", "boarded_count")[:MAX_SAMPLES]
    )
    rates = []
    for e in events:
        dwell = (e["departure_time"] - e["arrival_time"]).total_seconds()
        if 0 < dwell < 3600:
            rates.append(dwell / max(e["boarded_count"], 1))
    learned = len(rates) >= MIN_SAMPLES
    if learned:
        per = min(120, max(5, round(statistics.median(rates))))
    return {
        "boarding_seconds": per,
        "wheelchair_seconds": wc,
        # TODO: record wheelchair boardings on StopEvent so the wc premium can
        # also be learned instead of pinned to the policy constant.
        "samples": len(rates),
        "learned": learned,
    }
