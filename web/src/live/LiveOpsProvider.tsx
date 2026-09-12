import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { getAccessToken } from "../api/client";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

export interface LivePosition {
  tripId: string;
  lat: number;
  lng: number;
  heading: number;
  progress: number;
  currentStopSequence: number;
  stopCount: number;
  delaySeconds: number;
  lateProbability: number;
  p50Eta: string | null;
  routeCode: string;
  status?: string;
  updatedAt: number;
}

export interface LiveEvent {
  id: string;
  event: string;
  tripId: string;
  routeCode?: string;
  title: string;
  detail?: string;
  tone: "info" | "good" | "warn" | "bad";
  at: number;
}

interface LiveOpsValue {
  connected: boolean;
  positions: Record<string, LivePosition>;
  events: LiveEvent[];
  lastMessageAt: number | null;
  clearFeed: () => void;
}

const LiveOpsContext = createContext<LiveOpsValue>({
  connected: false,
  positions: {},
  events: [],
  lastMessageAt: null,
  clearFeed: () => undefined,
});

// eslint-disable-next-line react-refresh/only-export-components
export function useLiveOps() {
  return useContext(LiveOpsContext);
}

type Envelope = { event: string; trip_id: string; payload: Record<string, unknown> };

let eventSeq = 0;

export function LiveOpsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const districtId = user?.district;

  const [connected, setConnected] = useState(false);
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);
  const closedByUs = useRef(false);
  const invalidateTimer = useRef<number | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimer.current != null) return;
    invalidateTimer.current = window.setTimeout(() => {
      invalidateTimer.current = null;
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["guardian", "etas"] });
      qc.invalidateQueries({ queryKey: ["guardian-trip"] });
      qc.invalidateQueries({ queryKey: ["etas"] });
    }, 600);
  }, [qc]);

  const handleEnvelope = useCallback(
    (msg: Envelope) => {
      setLastMessageAt(Date.now());
      const p = msg.payload || {};
      if (msg.event === "trip.position.updated") {
        setPositions((prev) => ({
          ...prev,
          [msg.trip_id]: {
            tripId: msg.trip_id,
            lat: Number(p.latitude),
            lng: Number(p.longitude),
            heading: Number(p.heading || 0),
            progress: Number(p.progress || 0),
            currentStopSequence: Number(p.current_stop_sequence || 0),
            stopCount: Number(p.stop_count || 0),
            delaySeconds: Number(p.delay_seconds || 0),
            lateProbability: Number(p.late_probability || 0),
            p50Eta: (p.p50_eta as string) || null,
            routeCode: (p.route_code as string) || prev[msg.trip_id]?.routeCode || "",
            status: prev[msg.trip_id]?.status,
            updatedAt: Date.now(),
          },
        }));
        return;
      }
      if (msg.event === "trip.status.updated") {
        setPositions((prev) =>
          prev[msg.trip_id]
            ? { ...prev, [msg.trip_id]: { ...prev[msg.trip_id], status: String(p.status || "") } }
            : prev,
        );
        if (p.status === "completed") {
          setEvents((prev) =>
            [
              {
                id: `e${++eventSeq}`,
                event: msg.event,
                tripId: msg.trip_id,
                title: "Route completed",
                detail: "Bus reached the school.",
                tone: "good" as const,
                at: Date.now(),
              },
              ...prev,
            ].slice(0, 40),
          );
        }
        scheduleInvalidate();
        return;
      }
      if (msg.event === "trip.stop.arrived") {
        const isSchool = p.kind === "school";
        setEvents((prev) =>
          [
            {
              id: `e${++eventSeq}`,
              event: msg.event,
              tripId: msg.trip_id,
              title: isSchool ? "Arrived at school" : `Arrived at ${p.stop_name || "stop"}`,
              detail: `Stop ${p.sequence}${p.stop_count ? ` of ${p.stop_count}` : ""}`,
              tone: (isSchool ? "good" : "info") as LiveEvent["tone"],
              at: Date.now(),
            },
            ...prev,
          ].slice(0, 40),
        );
        return;
      }
      if (msg.event === "alert.created") {
        setEvents((prev) =>
          [
            {
              id: `e${++eventSeq}`,
              event: msg.event,
              tripId: msg.trip_id,
              title: (p.title as string) || "Delay alert",
              detail: "Families and dispatch notified.",
              tone: "bad" as const,
              at: Date.now(),
            },
            ...prev,
          ].slice(0, 40),
        );
        scheduleInvalidate();
        return;
      }
      if (msg.event === "incident.updated") {
        scheduleInvalidate();
      }
    },
    [scheduleInvalidate],
  );

  const clearFeed = useCallback(() => {
    setPositions({});
    setEvents([]);
    setLastMessageAt(null);
  }, []);

  useEffect(() => {
    if (!districtId) return;
    closedByUs.current = false;
    let stop = false;

    const connect = () => {
      if (stop) return;
      const token = getAccessToken();
      if (!token) {
        // Wait briefly for auth hydration, then retry.
        window.setTimeout(connect, 800);
        return;
      }
      const url = `${WS_BASE}/districts/${districtId}/?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };
      ws.onmessage = (ev) => {
        try {
          handleEnvelope(JSON.parse(ev.data) as Envelope);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (stop || closedByUs.current) return;
        retryRef.current = Math.min(retryRef.current + 1, 6);
        const delay = Math.min(1000 * 2 ** (retryRef.current - 1), 15000);
        window.setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      stop = true;
      closedByUs.current = true;
      wsRef.current?.close();
      wsRef.current = null;
      if (invalidateTimer.current != null) window.clearTimeout(invalidateTimer.current);
    };
  }, [districtId, handleEnvelope]);

  const value = useMemo(
    () => ({ connected, positions, events, lastMessageAt, clearFeed }),
    [connected, positions, events, lastMessageAt, clearFeed],
  );

  return <LiveOpsContext.Provider value={value}>{children}</LiveOpsContext.Provider>;
}
