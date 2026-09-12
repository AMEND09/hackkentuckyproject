"""Monte Carlo digital-twin stress tests for morning route plans."""

from __future__ import annotations

import random
from statistics import mean

from apps.districts.models import DistrictPolicy
from apps.routing.models import RoutePlan


def run_stress_test(run) -> dict:
    plan: RoutePlan = run.route_plan
    routes = list(plan.routes.all())
    if not routes:
        return {"error": "Plan has no routes"}
    rng = random.Random(int(run.n_simulations * 17 + run.traffic_severity * 100))
    n = max(100, min(run.n_simulations, 1000))
    policy = DistrictPolicy.objects.filter(district=run.district).first()
    max_ride = (policy.max_student_ride_minutes if policy else 45) * 60
    bell_buffer = (policy.min_arrival_buffer_minutes if policy else 10) * 60

    # Real Public Works snow/salt priority coverage per route (computed once by
    # the optimizer from apps.geodata; see Route.safety_context). Routes with
    # low coverage take a heavier, noisier hit in snow-day mode below.
    snow_uncovered_by_route = {
        str(r.id): 1.0 - float((r.safety_context or {}).get("snow_route_coverage", 1.0)) for r in routes
    }

    per_route = {str(r.id): {"late": 0, "ride_exceed": 0, "arrivals": [], "code": r.route_code} for r in routes}
    all_on_time = 0
    any_late = 0
    disruptions = 0
    driver_absences = 0
    rain_hits = 0
    snow_stuck_events = 0

    for _ in range(n):
        traffic = min(1.0, max(0.0, rng.gauss(run.traffic_severity, 0.12)))
        weather = min(1.0, max(0.0, rng.gauss(run.weather_severity, 0.1)))
        raining = run.rain or rng.random() < weather * 0.5
        if raining:
            rain_hits += 1
        morning_on_time = True
        for route in routes:
            start_delay = rng.randint(run.starting_delay_min, max(run.starting_delay_min, run.starting_delay_max)) * 60
            if rng.random() < run.driver_absence_rate:
                start_delay += 12 * 60
                driver_absences += 1
            board_noise = rng.gauss(0, 25 * run.boarding_variability) * route.student_count / 8
            wc_noise = rng.gauss(0, 40) * route.wheelchair_count * run.boarding_variability
            road = 0
            if rng.random() < run.road_disruption_rate:
                road = rng.randint(180, 900)
                disruptions += 1
            rain_pen = 0.16 * route.p50_duration_seconds if raining else 0
            traffic_pen = traffic * 0.28 * route.p50_duration_seconds
            weather_pen = weather * 0.08 * route.p90_duration_seconds
            snow_pen = 0.0
            if run.snow_day:
                uncovered = snow_uncovered_by_route[str(route.id)]
                snow_factor = min(1.0, max(0.0, rng.gauss(0.5, 0.15)))
                snow_pen = uncovered * snow_factor * 0.6 * route.p90_duration_seconds
                if rng.random() < uncovered * 0.15:
                    snow_pen += rng.randint(300, 900)
                    snow_stuck_events += 1
            actual = (
                route.p50_duration_seconds
                + start_delay
                + board_noise
                + wc_noise
                + road
                + rain_pen
                + traffic_pen
                + weather_pen
                + snow_pen
            )
            # scheduled arrival vs bell: use p50 as planned
            late_margin = actual - route.p50_duration_seconds
            late = late_margin > bell_buffer * 0.4 + 120
            if late:
                per_route[str(route.id)]["late"] += 1
                morning_on_time = False
            if actual > max_ride:
                per_route[str(route.id)]["ride_exceed"] += 1
            per_route[str(route.id)]["arrivals"].append(actual)
        if morning_on_time:
            all_on_time += 1
        else:
            any_late += 1

    route_stats = []
    for route in routes:
        rec = per_route[str(route.id)]
        arrivals = sorted(rec["arrivals"]) or [0]
        p50 = arrivals[int(0.5 * (len(arrivals) - 1))]
        p90 = arrivals[int(0.9 * (len(arrivals) - 1))]
        on_time = 1 - rec["late"] / n
        route_stats.append(
            {
                "route_id": str(route.id),
                "route_code": route.route_code,
                "on_time_probability": round(on_time, 3),
                "p50_duration_s": int(p50),
                "p90_duration_s": int(p90),
                "worst_s": int(max(arrivals)),
                "ride_time_exceed_probability": round(rec["ride_exceed"] / n, 3),
                "snow_route_coverage": round(1.0 - snow_uncovered_by_route[str(route.id)], 3),
            }
        )
    route_stats.sort(key=lambda r: r["on_time_probability"])
    vulnerable = route_stats[0] if route_stats else None
    factors = []
    if run.traffic_severity >= 0.5:
        factors.append("Corridor traffic is the dominant delay driver in this scenario.")
    if run.rain or run.weather_severity >= 0.4:
        factors.append("Rain and weather increase both average time and variance.")
    if run.starting_delay_max >= 8:
        factors.append("Yard departure delays compound before the first stop.")
    if run.driver_absence_rate >= 0.05:
        factors.append("Driver absence forces last-minute cover and late pull-outs.")
    if run.road_disruption_rate >= 0.08:
        factors.append("Road disruptions create heavy-tailed late arrivals.")
    if run.snow_day:
        worst_snow = min(route_stats, key=lambda r: r["snow_route_coverage"]) if route_stats else None
        if worst_snow and worst_snow["snow_route_coverage"] < 0.5:
            factors.append(
                f"Snow-day mode: {worst_snow['route_code']} is mostly off Public Works' priority plow routes "
                f"({worst_snow['snow_route_coverage']:.0%} covered) and absorbs the largest snow penalty."
            )
        else:
            factors.append("Snow-day mode: every route is well-covered by priority plow routes.")
    if not factors:
        factors.append("Under this mild scenario, boarding variation is the main remaining risk.")

    p_all = all_on_time / n
    interpretation = (
        f"In {n} simulated fictional mornings, the chance every bus arrives on time is {p_all:.0%}. "
        f"At least one bus is late in {any_late / n:.0%} of mornings. "
    )
    if vulnerable:
        interpretation += (
            f"{vulnerable['route_code']} is the most vulnerable route "
            f"({vulnerable['on_time_probability']:.0%} on-time). "
        )
    interpretation += " ".join(factors)
    interpretation += " This simulation uses synthetic travel models, not production GPS."

    payload = {
        "n_simulations": n,
        "probability_all_on_time": round(p_all, 3),
        "probability_at_least_one_late": round(any_late / n, 3),
        "routes": route_stats,
        "most_vulnerable_route": vulnerable,
        "main_risk_factors": factors,
        "probability_max_ride_exceeded": round(
            mean(r["ride_time_exceed_probability"] for r in route_stats) if route_stats else 0, 3
        ),
        "driver_absence_events": driver_absences,
        "road_disruption_events": disruptions,
        "rain_mornings": rain_hits,
        "snow_day_mode": bool(run.snow_day),
        "snow_stuck_events": snow_stuck_events,
        "synthetic": True,
    }
    if run.compare_plan_id:
        # lightweight paired summary from stored metrics
        other = run.compare_plan
        payload["comparison"] = {
            "primary_mode": plan.optimization_mode,
            "compare_mode": other.optimization_mode,
            "primary_on_time": plan.aggregate_metrics.get("average_on_time"),
            "compare_on_time": (other.aggregate_metrics or {}).get("average_on_time"),
        }
    return payload, interpretation
