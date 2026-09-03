# API

Base URL: `/api/v1/`. OpenAPI: `/api/schema/`, Swagger UI: `/api/docs/`.

Errors:

```json
{
  "error": {
    "code": "ROUTE_PLAN_INFEASIBLE",
    "message": "A feasible route plan could not be generated.",
    "details": { "reasons": ["Insufficient wheelchair capacity"] }
  }
}
```

## Auth

- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`
- `GET /auth/me/`
- `GET /auth/demo-credentials/` (when demo mode is on)

## Districts and roster

`/districts/`, `/districts/{id}/dashboard/`, `/districts/{id}/validate-dataset/`, `/policies/`, `/schools/`, `/depots/`, `/users/`, `/vehicles/`, `/drivers/`, `/students/`, `/stops/`, `/stop-assignments/`, `/guardian-links/`

## Imports

- `POST /imports/upload/`
- `POST /imports/{id}/confirm-mapping/`
- `POST /imports/{id}/validate/`
- `POST /imports/{id}/commit/`
- `GET /imports/{id}/errors.csv/`
- `GET /imports/templates/{kind}/`

## Routing and ML

- `/route-plans/` create, retrieve
- `POST /route-plans/{id}/generate/`
- `POST /route-plans/{id}/approve/`
- `POST /route-plans/{id}/publish/`
- `POST /route-plans/compare/`
- `/jobs/{id}/`
- `/stress-tests/`
- `/model-artifacts/`, `/model-artifacts/metrics/`

## Operations

- `/trips/` list (drivers see assigned only)
- `POST /trips/{id}/start|pause|resume|complete/`
- `POST /trips/{id}/arrive-stop/`, `depart-stop/`, `gps/`, `simulate-step/`, `disrupt/`
- `GET /trips/{id}/manifest/` (not for guardians)
- `/alerts/`, `POST /alerts/{id}/acknowledge/`
- `/incidents/`
- `GET /guardian/children/`, `/guardian/etas/`, `/guardian/history/`
- `POST /guardian/absent/`
- `/notifications/`

WebSocket (session auth; polling is the supported fallback):

- `ws/trips/{trip_id}/`
- `ws/districts/{district_id}/`

Events: `trip.position.updated`, `trip.status.updated`, `trip.eta.updated`, `alert.created`, `incident.updated`.
