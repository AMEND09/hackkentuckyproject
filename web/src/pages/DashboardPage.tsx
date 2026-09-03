import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bus, Clock, TrendingUp, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { RouteMap } from "../components/maps/RouteMap";
import { LoadingGrid } from "../components/ui/LoadingBlock";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";

const kpiIcons = [Bus, Users, TrendingUp, AlertTriangle, Bus, Clock];
const kpiAccents: Array<"sky" | "good" | "warn" | "bad"> = ["sky", "sky", "good", "warn", "sky", "warn"];

export function DashboardPage() {
  const { user } = useAuth();
  const districtId = user?.district;
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", districtId],
    enabled: Boolean(districtId) || user?.role === "platform_admin",
    queryFn: async () => {
      let id = districtId;
      if (!id) {
        const list = await api.get("/districts/");
        id = list.data.results?.[0]?.id || list.data[0]?.id;
      }
      const { data } = await api.get(`/districts/${id}/dashboard/`);
      return data;
    },
    refetchInterval: 8000,
  });

  if (isLoading) return <LoadingGrid count={6} />;
  if (error) return <p className="text-bad font-medium">Could not load dashboard.</p>;

  const kpis = [
    { label: "Active buses", value: data.active_buses, hint: "Currently rolling" },
    { label: "Students transported", value: data.students_transported, hint: "Eligible roster" },
    { label: "On-time routes", value: data.on_time_routes, hint: "Late probability < 25%" },
    { label: "At-risk routes", value: data.at_risk_routes, hint: "Needs dispatcher attention" },
    { label: "Fleet utilization", value: data.fleet_utilization, hint: "Active / available" },
    { label: "Avg delay", value: `${Math.round((data.average_delay_seconds || 0) / 60)} min`, hint: "Across active trips" },
  ];

  const points = (data.live_trips || [])
    .map((t: { id: string; last_position?: { latitude: string; longitude: string }; route_code: string; late_probability: number }) =>
      t.last_position
        ? {
            id: t.id,
            lat: Number(t.last_position.latitude),
            lng: Number(t.last_position.longitude),
            label: t.route_code,
            color: t.late_probability > 0.45 ? "#DC2626" : "#2563EB",
            kind: "bus" as const,
            heading: Number((t.last_position as { heading?: number }).heading || 0),
          }
        : null,
    )
    .filter(Boolean);
  const lines = (data.live_trips || [])
    .filter((t: { path?: [number, number][] }) => (t.path || []).length > 1)
    .map((t: { id: string; path: [number, number][]; late_probability: number }) => ({
      id: t.id,
      color: t.late_probability > 0.45 ? "#DC2626" : "#2563EB",
      coords: t.path,
      width: 5,
    }));

  return (
    <div className="page-shell">
      <PageHeader
        title="District operations"
        subtitle="Live picture of Jefferson Demo Schools. Predictions use synthetic models."
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((k, i) => {
          const Icon = kpiIcons[i] || Bus;
          return (
            <StatCard key={k.label} label={k.label} value={k.value} hint={k.hint} icon={Icon} accent={kpiAccents[i] || "sky"} />
          );
        })}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <h2 className="font-bold text-ink">Live fleet</h2>
            <Link to="/dispatch" className="link text-sm">
              Open dispatcher →
            </Link>
          </div>
          <RouteMap points={points} lines={lines} className="h-96 rounded-none border-0 border-t border-navy/[0.06]" />
        </div>
        <div className="card card-body">
          <h2 className="font-bold text-ink mb-4">Recent alerts</h2>
          {(data.recent_alerts || []).length === 0 && <p className="text-slate text-sm">No open alerts.</p>}
          <ul className="space-y-3">
            {(data.recent_alerts || []).map((a: { id: string; title: string; severity: string; message: string; trip?: string }) => (
              <li key={a.id} className="rounded-xl bg-canvas p-3.5 border border-navy/[0.04]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={a.severity === "critical" ? "badge-bad" : "badge-warn"}>{a.severity}</span>
                  {a.trip ? (
                    <Link className="link text-sm" to={`/drive/${a.trip}`}>
                      {a.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-sm">{a.title}</span>
                  )}
                </div>
                <p className="text-xs text-slate mt-2 leading-relaxed">{a.message}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
