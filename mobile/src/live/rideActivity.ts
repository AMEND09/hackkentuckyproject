import type { RideLivePayload } from "../../modules/dart-live-activity";
import { delayLabel, progress, splitClock, stopsAway, stopsAwayLabel } from "../format";
import type { GuardianEta } from "../types";

export function minutesUntil(iso?: string | null) {
  if (!iso) return 0;
  const date = iso.includes("T") ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
}

export function rideStatusLine(eta: GuardianEta) {
  if (eta.status === "completed") return "Arrived";
  const away = stopsAway(eta);
  if (away === 0) return "At your stop";
  if (away === 1) return "One stop away";
  if (!eta.on_time && (eta.delay_seconds || 0) >= 180) return "Running late";
  if (eta.status === "active") return "On the way";
  return stopsAwayLabel(eta);
}

export function payloadFromEta(eta: GuardianEta): RideLivePayload {
  const clock = splitClock(eta.p50_eta) || splitClock(eta.scheduled_pickup);
  const late = !eta.on_time && (eta.delay_seconds || 0) >= 180;
  return {
    studentId: eta.student_id,
    riderName: eta.student_first_name,
    routeCode: eta.route_code || "Bus",
    stopName: eta.stop_name || "Your stop",
    schoolName: eta.school_name || "",
    etaClock: clock?.clock || "—",
    etaPeriod: clock?.period || "",
    delayLabel: delayLabel(eta),
    late,
    progress: progress(eta),
    statusLine: rideStatusLine(eta),
    stopsAway: stopsAway(eta) ?? 0,
    minutes: minutesUntil(eta.p50_eta) || Math.max(2, Math.round((eta.stop_count || 4) * 2.4)),
  };
}
