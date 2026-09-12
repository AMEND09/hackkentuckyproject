import type { GuardianEta } from "../types";
import { delayLabel, splitClock } from "../format";

export type WidgetRider = {
  name: string;
  stop: string;
  route: string;
  clock: string;
  period: string;
  delay: string;
  late: boolean;
};

export function ridersFromEtas(etas: GuardianEta[] | undefined): WidgetRider[] {
  return (etas || []).slice(0, 2).map((e) => {
    const clock = splitClock(e.p50_eta) || splitClock(e.scheduled_pickup);
    return {
      name: e.student_first_name,
      stop: e.stop_name || "Stop",
      route: e.route_code || "Bus",
      clock: clock?.clock || "—",
      period: clock?.period || "",
      delay: delayLabel(e),
      late: !e.on_time && (e.delay_seconds || 0) >= 180,
    };
  });
}

export function fallbackRiders(): WidgetRider[] {
  return [
    { name: "Leo", stop: "Oakridge Stop 11", route: "Bus 14", clock: "7:38", period: "AM", delay: "+6 min", late: true },
    { name: "Mia", stop: "Maple & 3rd", route: "Bus 22", clock: "7:42", period: "AM", delay: "On time", late: false },
  ];
}

export async function syncWidgetSnapshot(riders: WidgetRider[]) {
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage("group.com.app.dart");
    const first = riders[0];
    if (first) {
      storage.set("name", first.name);
      storage.set("stop", first.stop);
      storage.set("route", first.route);
      storage.set("clock", first.clock);
      storage.set("period", first.period);
      storage.set("delay", first.delay);
      storage.set("late", first.late ? 1 : 0);
    }
    storage.set("secondName", riders[1]?.name || "");
    storage.set("secondClock", riders[1]?.clock || "");
    storage.set("secondDelay", riders[1]?.delay || "");
    ExtensionStorage.reloadWidget("DARTRiderWidget");
  } catch {
    // Widget target is optional until the native extension is installed.
  }
}
