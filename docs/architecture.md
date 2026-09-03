# Architecture

RouteWise is a proof of concept, not a production student transportation system.

## Client / backend

```mermaid
flowchart LR
  subgraph clients [Clients]
    Web[web Vite React]
    Mobile[mobile Expo]
  end
  subgraph backendApp [backend Django]
    API["/api/v1 REST"]
    WS[Channels WS]
    Celery[Celery workers]
    ORTools[OR-Tools solver]
    ML[sklearn joblib]
  end
  subgraph infra [infrastructure Compose]
    PG[(PostgreSQL)]
    Redis[(Redis)]
  end
  Web --> API
  Web --> WS
  Mobile --> API
  Mobile --> WS
  API --> PG
  WS --> Redis
  Celery --> Redis
  Celery --> PG
  Celery --> ORTools
  Celery --> ML
```

`web/`, `mobile/`, and `backend/` are independent applications. They do not share UI code. Both clients use `/api/v1/` and poll as a realtime fallback.

## Optimization pipeline

```mermaid
flowchart TD
  Import[CSV import or seed] --> Stops[Approved stop demand]
  Stops --> Matrix[Haversine matrix]
  Matrix --> Overlay[Optional ML P50/P90 overlay]
  Overlay --> Solve[OR-Tools CVRPTW]
  Solve -->|feasible| Persist[RoutePlan Route RouteStop]
  Solve -->|infeasible| Reasons[Structured reasons]
  Persist --> Metrics[P50 P90 on-time risk copy]
```

## ML pipeline

```mermaid
flowchart TD
  Synth[generate_synthetic_ml_data] --> CSV[20k fictional segments]
  CSV --> Train[train_travel_models]
  Train --> Artifacts[joblib + ModelArtifact]
  Artifacts --> Overlay[overlay_ml_matrix]
  Overlay --> Solver[Reliability vs fastest costs]
```

## Real-time GPS

```mermaid
sequenceDiagram
  participant Driver as Driver app
  participant API as Django API
  participant Trip as Trip + GPSPosition
  participant ML as Delay model
  participant WS as Channels
  participant Disp as Dispatcher UI
  Driver->>API: POST /trips/{id}/gps/ or simulate-step
  API->>Trip: store point
  API->>ML: refresh ETA and late probability
  ML->>API: maybe OperationalAlert
  API->>WS: trip.position.updated trip.eta.updated alert.created
  WS->>Disp: live map and alert feed
  Note over Driver,Disp: Clients also poll every few seconds
```

## Tenant isolation

```mermaid
flowchart TD
  Req[Authenticated request] --> Role{User.role}
  Role -->|platform_admin| All[Unfiltered queryset]
  Role -->|district staff| Dist[Filter district_id]
  Role -->|driver| Drive[Assigned trips and manifests only]
  Role -->|guardian| Guard[GuardianStudentLink students only]
  Role -->|anonymous| Deny[401]
```

Latitude/longitude are stored as decimals so Django can run on Windows without GDAL. The Compose image is PostGIS for a future spatial upgrade. Travel times use Haversine, not PostGIS.

Web access tokens live in `sessionStorage` with refresh in `localStorage` (POC). Mobile tokens use Expo Secure Store only.
