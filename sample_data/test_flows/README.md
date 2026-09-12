# Roster CSVs

Onboarding is drop-only. Name files `schools.csv`, `stops.csv`, `students.csv`, `vehicles.csv`, and `drivers.csv` (or include those words in the filename). Import order is automatic when you drop several at once.

**Required:** schools, students  
**Optional:** stops, vehicles, drivers (needed to generate routes and run live demo)

## Required columns

- **schools:** `school_id`, `name`, `latitude`, `longitude`
- **students:** `student_id`, `first_name`, `last_name`, `school_id`, `latitude`, `longitude`
- **stops:** `stop_id`, `name`, `latitude`, `longitude`
- **vehicles:** `vehicle_number`, `capacity`
- **drivers:** `employee_id`, `email`, `first_name`, `last_name`

Aliases (`SchoolID`, `SIS_ID`, `bus_number`) are mapped automatically.

## Packs (on disk only)

| Pack | What it is |
|------|------------|
| **happy_path** | Canonical headers. 2 schools, 8 stops, 16 students, 4 buses, 4 drivers. Matches the default Main Bus Depot. |
| **aliased_headers** | SIS-style column names. Adds a high school. |
| **required_only** | Only required columns. |
| **validation_errors** | Good row plus bad rows — the drop will show the first error. |

Do not mix packs in one district unless you know IDs will not collide.

## After import

Imported drivers can sign in with the email in the CSV and password `DemoPass123!`.

Parents are not a CSV. They join the district, then claim a rider code from Students.

Happy-path rider codes: AVA001, LEO002, MIA003, NOA004, KAI010.

Then: planner generate → approve → publish → Start live demo.
