import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Navigation } from "lucide-react";
import { api } from "../api/client";
import { RouteMap } from "../components/maps/RouteMap";
import { LoadingBlock } from "../components/ui/LoadingBlock";

export function TripDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: trip } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => (await api.get(`/trips/${id}/`)).data,
    refetchInterval: 3000,
  });
  const incident = useMutation({
    mutationFn: () => api.post("/incidents/", { trip: id, type: "traffic", severity: "medium", description: "Dispatcher-noted delay (demo)." }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip", id] }),
  });
  if (!trip) return <LoadingBlock rows={3} />;
  const stops = trip.stops || [];
  const pos = trip.last_position;
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{trip.route_code}</h1>
          <p className="page-sub capitalize">
            {trip.status.replace("_", " ")} · {Math.round(trip.current_delay_seconds / 60)} min delay ·{" "}
            {(trip.late_probability * 100).toFixed(0)}% late risk
            {trip.is_simulated ? " · Simulated GPS" : ""}
          </p>
        </div>
        <Link className="btn-route" to={`/app/drive/${trip.id}`}>
          <Navigation size={16} /> Open route guide
        </Link>
      </div>

      <div className="card overflow-hidden">
        <RouteMap
          className="h-96 rounded-none border-0"
          points={[
            ...stops.map((s: { id: string; latitude: string; longitude: string; name: string }) => ({
              id: s.id,
              lat: Number(s.latitude),
              lng: Number(s.longitude),
              label: s.name,
              color: "#2563EB",
            })),
            ...(pos
              ? [{ id: "bus", lat: Number(pos.latitude), lng: Number(pos.longitude), kind: "bus" as const, label: "Bus" }]
              : []),
          ]}
          lines={[
            {
              id: "path",
              color: "#2563EB",
              width: 6,
              coords: (trip.path && trip.path.length > 1
                ? trip.path
                : stops.map((s: { longitude: string; latitude: string }) => [Number(s.longitude), Number(s.latitude)] as [number, number])),
            },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card card-body">
          <h2 className="section-title">Stop sequence</h2>
          <ol className="space-y-2 text-sm">
            {stops.map((s: { id: string; name: string; scheduled_arrival: string }, i: number) => (
              <li key={s.id} className="flex gap-3">
                <span className="text-muted font-mono text-xs w-5">{i + 1}.</span>
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-slate ml-2 tabular-nums">{s.scheduled_arrival || "—"}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card card-body h-56">
          <h2 className="section-title">Delay trend</h2>
          <ResponsiveContainer>
            <LineChart data={[{ t: 0, d: 0 }, { t: 1, d: trip.current_delay_seconds / 60 }]}>
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line dataKey="d" stroke="#D97706" strokeWidth={2} dot={{ r: 4 }} name="Delay min" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="card card-body text-sm text-slate leading-relaxed">{trip.ml_explanation}</p>
      <button className="btn-secondary" onClick={() => incident.mutate()}>
        Create incident
      </button>
    </div>
  );
}
