# Demo script (about 6 minutes)

All names, GPS, and models are fictional. Say that out loud.

## Fully implemented

Seeded Jefferson Demo Schools, JWT roles, tenant isolation, CSV mapper, OR-Tools morning routes, synthetic quantile ML wired into fastest vs reliability, plan comparison, Monte Carlo twin, simulated GPS, dispatcher alerts, driver and guardian apps, `rundev.sh`.

## Simulated

Bus motion (`Simulate Drive` / `simulate-step`), dispatcher disruption minutes, digital-twin weather/traffic, dwell time noise.

## Trained on synthetic data

P50/P90 travel models and the late classifier. Metrics screens show the disclaimer.

## Future production work

Real map-matching at scale, self-hosted OSRM extract for offline street matrix, student information system connectors, FERPA review, hardware AVL, certified routing, push notifications at scale, PostGIS spatial indexes, hardened JWT cookies.

---

1. **District admin login** — http://localhost:5173 — `admin@jefferson.demo` / `DemoPass123!`.
2. **Import** — Onboarding: upload `sample_data/students.csv`, confirm mapping, validate.
3. **Fastest plan** — Planner, Oakridge, mode Fastest, Generate. Map colors routes.
4. **Bad-day risk** — Open a generated route’s risk copy. Note thin bell slack.
5. **Reliability plan** — Generate with Reliability mode (uses P90).
6. **Compare** — Compare page, fastest vs reliability: mileage, vehicles, on-time.
7. **Rain and traffic** — Digital twin: rain on, traffic 0.7, 750 simulations. Read the interpretation.
8. **Driver simulated trip** — Publish the reliability plan. Expo / driver login `driver@jefferson.demo`. Open today’s trip, **Simulate Drive**.
9. **Dispatcher alert** — Dispatcher console: at-risk trip, predicted delay, Acknowledge. Optional “Simulate disruption.”
10. **Guardian ETA** — `guardian@jefferson.demo` sees only Ava Bennett, stop, delayed/on-time, no manifests and no other children.
