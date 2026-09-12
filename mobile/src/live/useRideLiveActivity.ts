import { useEffect, useRef } from "react";
import { endRideLiveActivity, startRideLiveActivity, updateRideLiveActivity } from "../../modules/dart-live-activity";
import type { GuardianEta } from "../types";
import { payloadFromEta } from "./rideActivity";

function isLiveTrip(eta?: GuardianEta) {
  if (!eta?.trip_id || eta.status === "unassigned") return false;
  if (eta.status === "active" || eta.status === "completed") return true;
  return Number.isFinite(Number(eta.latitude)) && Number.isFinite(Number(eta.longitude));
}

/** Starts/updates the lock-screen Live Activity while a trip is live. */
export function useRideLiveActivity(eta?: GuardianEta) {
  const lastKey = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!isLiveTrip(eta)) {
      if (lastKey.current) {
        lastKey.current = "";
        void endRideLiveActivity();
      }
      return;
    }

    const payload = payloadFromEta(eta);
    const key = [
      eta.student_id,
      eta.trip_id,
      eta.status,
      payload.minutes,
      payload.progress.toFixed(1),
      payload.statusLine,
    ].join("|");
    if (key === lastKey.current) return;

    timer.current = setTimeout(() => {
      lastKey.current = key;
      if (eta.status === "completed") {
        void endRideLiveActivity({ ...payload, statusLine: "Arrived", minutes: 0, progress: 1 });
        return;
      }
      void startRideLiveActivity(payload).then((id) => {
        if (!id) void updateRideLiveActivity(payload);
      });
    }, 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [eta]);

  useEffect(() => {
    return () => {
      lastKey.current = "";
    };
  }, []);
}
