import { Platform } from "react-native";

export type RideLivePayload = {
  studentId: string;
  riderName: string;
  routeCode: string;
  stopName: string;
  schoolName: string;
  etaClock: string;
  etaPeriod: string;
  delayLabel: string;
  late: boolean;
  progress: number;
  statusLine: string;
  stopsAway: number;
  minutes: number;
};

type Native = {
  areActivitiesEnabled?: boolean | (() => boolean);
  isRunning: () => boolean | Promise<boolean>;
  start: (payload: RideLivePayload) => Promise<string | null>;
  update: (payload: RideLivePayload) => Promise<void>;
  end: (payload?: RideLivePayload) => Promise<void>;
};

let cached: Native | null | undefined;

function getNative(): Native | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== "ios") {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo-modules-core") as {
      requireNativeModule: (name: string) => Native;
    };
    cached = requireNativeModule("DartLiveActivity");
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function liveActivitiesEnabled() {
  const native = getNative();
  if (!native) return false;
  const value = native.areActivitiesEnabled;
  return typeof value === "function" ? Boolean(value()) : Boolean(value);
}

export async function startRideLiveActivity(payload: RideLivePayload) {
  const native = getNative();
  if (!native) {
    console.warn("DART Live Activity: native module missing. Rebuild the iOS app (not Expo Go).");
    return null;
  }
  try {
    return await native.start(payload);
  } catch (error) {
    console.warn("DART Live Activity start failed", error);
    return null;
  }
}

export async function updateRideLiveActivity(payload: RideLivePayload) {
  const native = getNative();
  if (!native) return;
  try {
    const running = await native.isRunning();
    if (running) await native.update(payload);
    else await native.start(payload);
  } catch (error) {
    console.warn("DART Live Activity update failed", error);
  }
}

export async function endRideLiveActivity(payload?: RideLivePayload) {
  const native = getNative();
  if (!native) return;
  try {
    await native.end(payload);
  } catch {
    /* ignore */
  }
}
