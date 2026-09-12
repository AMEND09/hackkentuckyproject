# DART Mobile — Guardian & Student App Scope

Rebrand + rebuild of the Expo `mobile/` app into **DART**, a family-facing app for
**guardians and students** to see their rider's bus, route, and live location.

- **Framework:** React Native via **Expo** (Expo Router) — already in `mobile/`.
- **Backend:** the **same Django `/api/v1/`** used by web. No parallel backend.
- **Design source:** `Auth screens setup (2)/DART Guardian.dc.html` (6 screens, 4-tab shell)
  and the DART brand marks in `brand/`.
- **Scope of this doc:** the guardian/student experience only. Driver app stays as-is
  for now (separate track), but shares the shell components we build here.

---

## 1. Goals & non-goals

**Goals**
- Sign in with district credentials; see only *your* linked riders (privacy-first).
- "Today" overview of each rider's morning: stop, scheduled pickup, on-time/late.
- **Live tracking**: map with the bus moving, remaining stops timeline, live ETA.
- Updates feed (delays, departures, stop changes) scoped to the rider's routes.
- Report an absence for a rider.
- Settings: profile, notification toggles, sign out.

**Non-goals (this phase)**
- No manifests or other students' data ever shown to families (FERPA-shaped).
- No real GPS hardware — bus positions are **simulated** and labeled as such.
- No push notifications infra in phase 1 (in-app feed only; see Phase 4).
- No offline mode beyond cached last response.

---

## 2. Brand (from the design)

| Token | Value | Use |
| --- | --- | --- |
| Primary | `#2563EB` (hover `#1D4ED8`) | buttons, active tab, links, bus marker |
| Ink | `#111827` | primary text |
| Muted | `#64748B` / `#94A3B8` | secondary text, captions |
| Border | `#E2E8F0` | card/input borders |
| Surface | `#FFFFFF`, field bg `#F8FAFC` | cards, inputs |
| Map bg | `#070C16` | live map canvas |
| Late/warn | `#D97706` (bg `rgba(217,119,6,.08)`) | delay chips, live stop |
| Heading font | `Space Grotesk` | h1/h2, big ETA clock |
| Body font | system / Inter-like | everything else |

- Replace "RouteWise" wordmark with **DART** logo (`brand/dart-logo.png`) and mark
  (`brand/dart-mark.png`). App icon/splash use `dart-mark.png`.
- Add fonts via `expo-font` (`Space_Grotesk` from `@expo-google-fonts/space-grotesk`).

---

## 3. Information architecture

Bottom tab bar (guardian): **Today · Track · Updates · Settings**.
Sign-in lives outside the tabs. Absence is a sheet that rises over Today/Track.

```
app/
  _layout.tsx            # root: fonts, QueryClient, SafeArea, auth gate
  index.tsx              # role router: guardian/student -> (guardian) tabs; driver -> driver
  login.tsx              # DART sign in (screen 01)
  register.tsx           # optional self sign-up (uses /auth/register)
  (guardian)/
    _layout.tsx          # Tabs: Today, Track, Updates, Settings
    today.tsx            # screen 02 — rider cards + alert banner
    track.tsx            # screen 03 — live map + remaining stops + ETA + absent
    updates.tsx          # screen 05 — notifications feed
    settings.tsx         # screen 06 — profile, toggles, sign out
  driver/                # unchanged for now
components/
  brand/DartLogo.tsx
  ui/{Card,Chip,Button,Toggle,Screen,Header,TabBarIcon}.tsx
  track/{LiveMap,StopTimeline,EtaClock,SimulatedBadge}.tsx
  RiderCard.tsx, AbsenceSheet.tsx, NotificationRow.tsx
src/
  api/client.ts          # exists (axios + SecureStore + refresh)
  api/hooks.ts           # typed react-query hooks (children, etas, notifications…)
  auth/AuthProvider.tsx  # me(), role, sign in/out, token state
  types.ts               # shared response types
  theme.ts               # brand tokens above
  useRiderTracking.ts    # polling + (later) WS for a rider's trip
```

### Navigation map
```
Sign in ──▶ Today ──▶ Track (per rider "Track live →")
                └─▶ Absence sheet (from Today or Track)
Today/Track/Updates/Settings via tab bar
Track ──▶ Updates (from "Track →" links) and back
Settings ──▶ Sign out ──▶ Sign in
```

---

## 4. Screen specs (design → data bindings)

All data comes from existing endpoints unless marked **[backend]**.

### 01 — Sign in (`login.tsx`)
- Email + password, primary "Sign in", "Forgot password?" (Phase 4), privacy note.
- Demo quick-login buttons when `EXPO_PUBLIC_DEMO_MODE === "true"`.
- API: `POST /auth/login/` → store `tokens.access/refresh` in SecureStore; route by `user.role`.
- Note copy: "You will only ever see the riders linked to your account. Bus locations
  in this demo are simulated."

### 02 — Today (`today.tsx`)
- Greeting header ("Thursday morning"), one **RiderCard** per rider.
- RiderCard: rider name, `stop_name · route_code`, status chip (On time / +N min),
  "Track live →" → `track.tsx?rider=<student_id>`.
- Alert banner if any rider's route has an open delay ("Route 22 is running late").
- Footer privacy line.
- API: `GET /guardian/etas/` (poll 5s) + `GET /guardian/children/` for names/school.
- Alert banner source: `GET /notifications/` (latest unread delay) or `late_probability`.

### 03 — Track (`track.tsx`) — the centerpiece
- Header: `rider · route_code`, live delay chip (`+N min`, amber when late).
- **LiveMap** (`react-native-maps`): bus marker at `latitude/longitude` with `heading`,
  route polyline, stop pins; dark map style; "Simulated GPS" badge overlay.
- Big **EtaClock**: `p50_eta` formatted (e.g., "7:48 AM") + "Arriving at <stop>. Scheduled
  pickup was <scheduled_pickup>."
- **StopTimeline**: remaining stops with completed / current(pulsing) / upcoming states,
  rider's own stop highlighted, school as final node with bell time.
- Absent button → AbsenceSheet.
- API: `GET /guardian/etas/` for live fields (`latitude,longitude,heading,current_stop_sequence,
  my_stop_sequence,p50_eta,delay_seconds,trip_id,route_code`). For the polyline + full stop
  list: `GET /trips/{trip_id}/` (route stops + path). Refresh 5s (Phase 3: WS).
- **[backend, minor]** confirm `/trips/{id}/` is readable by guardians for their rider's trip,
  or add a slim `GET /guardian/trip/{student_id}/` returning path + stops (no manifest).

### 04 — Absence sheet (`AbsenceSheet.tsx`)
- Rises over Today/Track. Shows rider + stop, optional note, Confirm / Cancel.
- Copy: "The driver and dispatch will see this before the bus reaches <stop>."
- API: `POST /guardian/absent/ { student_id, note? }`. **[backend, optional]** accept `note`.

### 05 — Updates (`updates.tsx`)
- List of notifications with icon, title, body, time; "Mark all read"; "Track →" deep link.
- Only routes the rider is on (backend already scopes notifications to the district/links).
- API: `GET /notifications/`; **[backend, optional]** `POST /notifications/{id}/read/` and
  `POST /notifications/read-all/` (or client-side read state in Phase 1).

### 06 — Settings (`settings.tsx`)
- Profile row (name, "Guardian · <district>"), notification toggles: Arrival estimates,
  Delay notices, School announcements; Sign out.
- API: `GET /auth/me/`; `PATCH /guardian-links/me/ { notification_preferences }` (used already).
- Sign out clears SecureStore tokens → `login.tsx`.

---

## 5. Students viewing their bus — DECIDED: self-guardian

**Decision: students are modeled as "self-guardians."** A student signs in with their own
account, which has a `GuardianStudentLink` pointing to **their own** `Student` record.

Why: the backend has no `student` role (roles: platform_admin, district_admin, planner,
dispatcher, driver, guardian), and `GuardianViewSet` already scopes everything to the
signed-in user's verified links. A self-link means **the entire guardian app works
unchanged** for students — zero UI forks, no new role enum/migration/permission branches.

Implications:
- **No frontend forks.** Today/Track/Updates/Settings render identically; a student just
  happens to have exactly one linked rider (themselves).
- **Backend work is seeding/registration only:** create the student's `User` (role
  `guardian`) + a verified `GuardianStudentLink` to their own `Student` (see §6).
- Copy tweak: Settings can show "Student · <school>" vs "Guardian · <district>" purely
  from whether the linked student *is* the user — cosmetic only, optional.

Rejected: a first-class `student` role (more backend work, no demo benefit) and
claim-code self sign-up (out of scope this phase).

---

## 6. Backend gaps / changes

Mostly already covered. Proposed small additions (all optional for Phase 1):

- **Guardian trip detail** `GET /guardian/trip/{student_id}/` → `{ path, stops[], school, bell }`
  so Track doesn't call the staff `/trips/{id}/`. (Or confirm trip read access for linked guardians.)
- **Absence note**: accept `note` in `POST /guardian/absent/`.
- **Notification read state**: `POST /notifications/{id}/read/` + `read-all/`.
- **Self-guardian seeding (chosen student model, §5)**: seed a demo student `User`
  (role `guardian`, e.g. `student@jefferson.demo`) with a verified `GuardianStudentLink`
  to their own `Student`. This is the only backend work needed for the student experience.
- No changes needed for: children, etas (already rich), history, login/refresh/me, register.

---

## 7. Live tracking approach

- **Phase 1:** react-query polling every 5s of `/guardian/etas/` (bus position) and a
  cached `/trips/{id}/` for the static polyline/stops. Smooth marker with simple lerp.
- **Phase 3:** subscribe to `ws/trips/{trip_id}/` (events `trip.position.updated`,
  `trip.eta.updated`, `trip.status.updated`) for push updates; fall back to polling.
- **Demo aid:** dispatcher/driver `POST /trips/{id}/simulate-step/` advances the bus so
  Track visibly moves during a demo. Keep the "Simulated GPS" badge.
- Map: `react-native-maps` (installed). Bus marker rotates by `heading`. Consider a
  custom dark map style to match `#070C16`.

---

## 8. Tech / dependencies

Already present: `expo`, `expo-router`, `expo-location`, `expo-secure-store`,
`react-native-maps`, `@tanstack/react-query`, `axios`, `react-hook-form`, `zod`.

Add:
- `@expo-google-fonts/space-grotesk` + `expo-font` (brand headings)
- `@gorhom/bottom-sheet` (absence sheet) or a simple RN Modal to avoid deps
- `expo-image` (crisp logo/marker rendering) — optional
- `date-fns` (ETA/time formatting) — optional

Config:
- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`, `EXPO_PUBLIC_DEMO_MODE` (already used).
- `app.json`: rename to DART, set icon/splash from `brand/dart-mark.png`, scheme `dart`.

---

## 9. Phasing & estimates

| Phase | Deliverable | Est. |
| --- | --- | --- |
| 0 | Rebrand: app.json, fonts, theme.ts, DartLogo, tab shell scaffolding | 0.5d |
| 1 | Auth + AuthProvider + role router + Sign in (DART) | 0.5d |
| 2 | Today (rider cards, alert banner) + Settings (toggles, sign out) | 1d |
| 3 | Track: LiveMap + StopTimeline + EtaClock (polling) | 1.5d |
| 4 | Updates feed + Absence sheet | 0.5d |
| 5 | Student self-guardian seeding + demo polish | 0.5d |
| 6 | WebSocket live updates (replace polling on Track) | 0.5d |

~5 dev-days for a polished demo; Phases 0–4 (~4d) are the demoable core.

---

## 10. Acceptance criteria

- Guardian and student sign in and land on **Today** with only their own rider(s).
- Track shows a moving bus, the rider's stop highlighted, and a live ETA that updates
  as `simulate-step` runs. "Simulated GPS" badge always visible.
- Marking absent posts to backend and reflects in dispatcher/driver views.
- No endpoint or screen ever exposes another family's students or a manifest.
- Works on iOS simulator and a physical phone on LAN (`EXPO_PUBLIC_API_URL` = LAN IP).

---

## 11. Risks / notes

- **react-native-maps** needs a dev build / config plugin on iOS; Expo Go may limit native
  maps. Fallback: MapLibre RN or a static route image if Expo Go is required for judging.
- Guardian access to `/trips/{id}/` must be verified or replaced with the scoped endpoint
  (§6) to avoid leaking manifest data.
- Simulated positions require someone (or a timer) to call `simulate-step` during the demo.
- Keep all "demo/simulated/synthetic" labels for honesty with judges.
