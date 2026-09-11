import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Navigation, Play, Square } from "lucide-react";
import { api } from "../api/client";
import { RouteMap } from "../components/maps/RouteMap";
import { PageHeader } from "../components/ui/PageHeader";
import { interpolateAlong, headingAlongPath, lerpAngleDegrees, routeDurationMs, type RouteCoord } from "../utils/routePath";

type Stop = {
  id: string;
  name: string;
  kind: string;
  sequence: number;
  latitude: string;
  longitude: string;
  student_count?: number;
};

type Trip = {
  id: string;
  route_code: string;
  school_name: string;
  status: string;
  current_delay_seconds: number;
  late_probability: number;
  is_simulated: boolean;
  current_stop_sequence: number;
  last_position?: { latitude: string; longitude: string; heading?: number };
  stops?: Stop[];
  path?: [number, number][];
  guidance?: {
    instruction: string;
    then?: string;
    next_stop_name: string | null;
    distance_to_next_km: number;
    eta_minutes: number;
    follows_streets?: boolean;
    upcoming_turns?: { instruction: string; street: string; distance_m: number }[];
    disclaimer: string;
  };
};

export function DrivePage() {
  const { id } = useParams();
  const { data: trips } = useQuery({
    queryKey: ["trips", "drive"],
    queryFn: async () => (await api.get("/trips/", { params: { page_size: 50 } })).data,
  });
  const rows: Trip[] = trips?.results || [];
  if (!id) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Route guide"
          subtitle="Pick a run — the blue line follows Louisville streets. Tap Start to simulate the drive."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((t) => (
            <Link key={t.id} to={`/app/drive/${t.id}`} className="card-hover group block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-route">{t.school_name}</div>
                  <div className="text-xl font-bold mt-1 group-hover:text-route transition-colors">{t.route_code}</div>
                  <div className="text-sm text-slate mt-1 capitalize">
                    {t.status.replace("_", " ")}
                    {t.is_simulated ? " · live sim" : ""}
                  </div>
                </div>
                <span className={t.late_probability > 0.45 ? "badge-bad" : "badge-good"}>
                  {Math.round(t.current_delay_seconds / 60)}m late
                </span>
              </div>
              <div className="mt-4 text-sm font-semibold text-route flex items-center gap-1">
                Open navigation <Navigation size={14} />
              </div>
            </Link>
          ))}
          {rows.length === 0 && <p className="text-slate col-span-2">No trips yet — publish a plan from Route planner.</p>}
        </div>
      </div>
    );
  }
  return <DriveGuide tripId={id} />;
}

function DriveGuide({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const [sim, setSim] = useState(false);
  const [liveBus, setLiveBus] = useState<{ lat: number; lng: number; heading: number } | null>(null);
  const tRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const simStartRef = useRef<number | null>(null);
  const lastSyncRef = useRef(0);
  const smoothHeadingRef = useRef<number | null>(null);

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => (await api.get(`/trips/${tripId}/`)).data as Trip,
    refetchInterval: sim ? false : 2500,
  });
  const act = useMutation({
    mutationFn: (path: string) => api.post(`/trips/${tripId}/${path}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip", tripId] }),
  });

  const street = useMemo(
    () => (trip?.path && trip.path.length > 1 ? trip.path : []) as RouteCoord[],
    [trip?.path],
  );
  const driveDurationMs = useMemo(() => routeDurationMs(street), [street]);

  const syncSimStep = (t: number) => {
    api.post(`/trips/${tripId}/simulate-step/`, { t }).catch(() => {});
  };

  const startDrive = async () => {
    if (!street.length) return;
    try {
      await act.mutateAsync("start/");
    } catch {
      // Trip may already be active — still run the demo simulation.
    }
    tRef.current = 0;
    simStartRef.current = null;
    smoothHeadingRef.current = null;
    const start = interpolateAlong(street, 0);
    smoothHeadingRef.current = headingAlongPath(street, 0);
    setLiveBus({ ...start, heading: smoothHeadingRef.current });
    syncSimStep(0.01);
    setSim(true);
  };

  useEffect(() => {
    if (!sim || street.length < 2) return;

    const tick = (now: number) => {
      if (simStartRef.current == null) simStartRef.current = now - tRef.current * driveDurationMs;
      const elapsed = now - simStartRef.current;
      const t = Math.min(0.99, elapsed / driveDurationMs);
      tRef.current = t;

      const pos = interpolateAlong(street, t);
      const targetHeading = headingAlongPath(street, t);
      const prevHeading = smoothHeadingRef.current ?? targetHeading;
      smoothHeadingRef.current = lerpAngleDegrees(prevHeading, targetHeading, 0.14);
      setLiveBus({ lat: pos.lat, lng: pos.lng, heading: smoothHeadingRef.current });

      if (now - lastSyncRef.current >= 2500) {
        lastSyncRef.current = now;
        syncSimStep(t);
      }

      if (t >= 0.99) {
        syncSimStep(0.99);
        qc.invalidateQueries({ queryKey: ["trip", tripId] });
        setSim(false);
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [sim, street, tripId, driveDurationMs, qc]);

  const stops = trip?.stops || [];
  const seq = trip?.current_stop_sequence || 0;
  const pos = trip?.last_position;
  const g = trip?.guidance;
  const apiBus = useMemo(() => {
    if (!pos) return null;
    return {
      lat: Number(pos.latitude),
      lng: Number(pos.longitude),
      heading: Number(pos.heading || 0),
    };
  }, [pos]);
  const bus = liveBus ?? apiBus;

  const split = useMemo(() => {
    if (!street.length) return { done: [] as [number, number][], next: [] as [number, number][] };
    if (!bus) return { done: [] as [number, number][], next: street };
    let best = 0;
    let bestD = Infinity;
    street.forEach((c, i) => {
      const d = (c[1] - bus.lat) ** 2 + (c[0] - bus.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return {
      done: street.slice(0, best + 1),
      next: [[bus.lng, bus.lat] as [number, number], ...street.slice(best)],
    };
  }, [street, bus]);
  const upcoming = stops.filter((s) => s.sequence > seq);
  const turns = g?.upcoming_turns || [];

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-canvas">
        <div className="glass px-8 py-6 text-center">
          <Navigation className="mx-auto text-route mb-2 animate-pulse" size={28} />
          <p className="font-semibold">Loading route…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] bg-canvas">
      <RouteMap
        className="h-full rounded-none border-0 shadow-none"
        fit={false}
        follow={bus}
        followSmooth={sim}
        followDuration={700}
        lines={[
          { id: "done", color: "#94A3B8", width: 7, coords: split.done.length > 1 ? split.done : [] },
          { id: "next", color: "#2563EB", width: 9, coords: split.next.length > 1 ? split.next : street },
        ]}
        points={[
          ...stops.map((s) => ({
            id: s.id,
            lat: Number(s.latitude),
            lng: Number(s.longitude),
            label: s.name,
            color: s.sequence <= seq ? "#94A3B8" : s.kind === "school" ? "#059669" : "#D97706",
            kind: "stop" as const,
          })),
          ...(bus
            ? [{ id: "bus", lat: bus.lat, lng: bus.lng, heading: bus.heading, kind: "bus" as const, label: "Bus" }]
            : []),
        ]}
      />

      <Link
        to="/app/drive"
        className="absolute top-4 left-4 z-10 glass px-3 py-2 text-sm font-semibold flex items-center gap-2 hover:bg-white"
      >
        <ArrowLeft size={16} /> Routes
      </Link>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 glass px-5 py-4 w-[min(100%,28rem)] mx-4">
        <div className="flex gap-4">
          <div className="shrink-0 h-12 w-12 rounded-2xl bg-route/10 flex items-center justify-center text-route">
            <Navigation size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate">{trip.route_code}</p>
            <h1 className="text-xl font-bold leading-snug text-navy">{g?.instruction || "Follow the route"}</h1>
            {g?.then && <p className="text-sm text-slate mt-0.5 truncate">Then {g.then}</p>}
            <div className="flex flex-wrap gap-3 mt-2 text-xs font-semibold text-slate">
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} className="text-route" />
                {g?.distance_to_next_km ? `${(g.distance_to_next_km * 0.621371).toFixed(1)} mi` : "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} className="text-route" />
                {g?.eta_minutes ?? "—"} min
              </span>
              {g?.follows_streets && <span className="text-good">On streets</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold tabular-nums ${trip.current_delay_seconds > 180 ? "text-bad" : "text-navy"}`}>
              {Math.round(trip.current_delay_seconds / 60)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate">min delay</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-10 space-y-3">
        <div className="glass p-4 max-h-52 overflow-y-auto">
          <h2 className="section-title">{turns.length ? "Turn-by-turn" : "Stops ahead"}</h2>
          <ol className="space-y-2">
            {(turns.length ? turns : upcoming.slice(0, 6)).map((item, i) => {
              const label = "instruction" in item ? item.instruction : item.name;
              const dist = "distance_m" in item ? item.distance_m : undefined;
              return (
                <li key={i} className={`text-sm flex gap-2 ${i === 0 ? "font-semibold text-navy" : "text-slate"}`}>
                  <span className="shrink-0 w-5 h-5 rounded-full bg-canvas text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span>
                    {label}
                    {dist
                      ? ` · ${dist >= 160 ? `${(dist / 1609).toFixed(1)} mi` : `${Math.round(dist * 3.281)} ft`}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="glass-dark p-3 flex flex-wrap gap-2">
          <button
            className="btn-route flex-1 min-w-[120px]"
            disabled={sim || act.isPending || street.length < 2}
            onClick={() => startDrive()}
          >
            <Play size={16} /> {sim ? "Driving…" : "Start"}
          </button>
          <button
            className={`flex-1 min-w-[120px] ${sim ? "btn-danger" : "btn-secondary !bg-white/15 !text-white !border-white/20 hover:!bg-white/25"}`}
            disabled={street.length < 2}
            onClick={() => {
              if (sim) {
                setSim(false);
                syncSimStep(tRef.current);
                qc.invalidateQueries({ queryKey: ["trip", tripId] });
              } else {
                simStartRef.current = null;
                setSim(true);
              }
            }}
          >
            {sim ? (
              <>
                <Square size={16} /> Stop
              </>
            ) : (
              <>
                <Navigation size={16} /> Follow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
