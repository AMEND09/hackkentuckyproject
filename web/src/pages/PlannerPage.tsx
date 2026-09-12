import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Construction, Loader2, Map, Route, ShieldAlert } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { MapPoint, RouteMap } from "../components/maps/RouteMap";
import { PageHeader } from "../components/ui/PageHeader";
import { RiskFactorList } from "../components/ui/RiskFactorList";
import { StatCard } from "../components/ui/StatCard";
import { useHazardLayers } from "../hooks/useHazardLayers";
import type { RiskFactor, SafetyContext } from "../types";

const COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626", "#0D9488", "#C2410C"];

const STATUS_BADGE: Record<string, string> = {
  published: "badge-good",
  approved: "badge-good",
  generating: "badge-warn",
  failed: "badge-bad",
  draft: "badge-neutral",
};

export function PlannerPage() {
  const qc = useQueryClient();
  const { data: schools } = useQuery({ queryKey: ["schools"], queryFn: async () => (await api.get("/schools/")).data });
  const { data: vehicles } = useQuery({ queryKey: ["vehicles"], queryFn: async () => (await api.get("/vehicles/")).data });
  const { data: drivers } = useQuery({ queryKey: ["drivers"], queryFn: async () => (await api.get("/drivers/")).data });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: async () => (await api.get("/route-plans/", { params: { page_size: 50 } })).data });
  const [school, setSchool] = useState("");
  const [mode, setMode] = useState("fastest");
  const [planId, setPlanId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [weights, setWeights] = useState({ time: 6, distance: 3, vehicles: 8, reliability: 4 });
  const [showCorridors, setShowCorridors] = useState(true);
  const [showConstruction, setShowConstruction] = useState(true);

  useEffect(() => {
    const list = plans?.results || [];
    if (!planId && list.length) {
      const published = list.find((p: { status: string }) => p.status === "published") || list[0];
      setPlanId(published.id);
    }
  }, [plans, planId]);

  const { data: plan, refetch } = useQuery({
    queryKey: ["plan", planId],
    enabled: Boolean(planId),
    queryFn: async () => (await api.get(`/route-plans/${planId}/`)).data,
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 1500 : false),
  });

  const { data: job } = useQuery({
    queryKey: ["job", plan?.job_id],
    enabled: Boolean(plan?.job_id) && plan?.status === "generating",
    queryFn: async () => (await api.get(`/jobs/${plan.job_id}/`)).data,
    refetchInterval: 1200,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/route-plans/", {
        name: `${mode} plan`,
        school: school || schools?.results?.[0]?.id,
        optimization_mode: mode,
        objective_weights: weights,
      });
      return data;
    },
    onSuccess: async (p) => {
      setPlanId(p.id);
      await api.post(`/route-plans/${p.id}/generate/`, {
        optimization_mode: mode,
        objective_weights: weights,
        vehicle_ids: (vehicles?.results || []).map((v: { id: string }) => v.id),
        driver_ids: (drivers?.results || []).map((d: { id: string }) => d.id),
      });
      qc.invalidateQueries({ queryKey: ["plans"] });
      refetch();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const publish = useMutation({
    mutationFn: async () => api.post(`/route-plans/${planId}/publish/`),
    onSuccess: () => refetch(),
  });
  const approve = useMutation({
    mutationFn: async () => api.post(`/route-plans/${planId}/approve/`),
    onSuccess: () => refetch(),
  });

  const routes = plan?.routes || [];
  const lines = routes.map((r: { id: string; stops: { longitude: string; latitude: string }[] }, i: number) => ({
    id: r.id,
    color: COLORS[i % COLORS.length],
    coords: r.stops.map((s) => [Number(s.longitude), Number(s.latitude)] as [number, number]),
    width: 5,
  }));
  const points: MapPoint[] = routes.flatMap(
    (r: { stops: { id: string; latitude: string; longitude: string; name: string }[] }) =>
      r.stops.map((s) => ({ id: s.id, lat: Number(s.latitude), lng: Number(s.longitude), label: s.name })),
  );

  const { hazardLines, hazardPoints } = useHazardLayers(points, { showCorridors, showConstruction });

  const planList = plans?.results || [];
  const isGenerating = create.isPending || plan?.status === "generating";

  return (
    <div className="page-shell">
      <PageHeader
        title="Route planner"
        subtitle="OR-Tools capacitated VRP with time windows. Travel times use Haversine plus synthetic P50/P90 models."
        actions={
          plan && (
            <span className={STATUS_BADGE[plan.status] || "badge-neutral"}>{plan.status}</span>
          )
        }
      />

      <div className="card card-body">
        <div className="grid md:grid-cols-4 gap-4">
          <label>
            <span className="label">School</span>
            <select className="select" value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">Select…</option>
              {(schools?.results || []).map((s: { id: string; name: string }) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Optimization</span>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="fastest">Fastest (P50)</option>
              <option value="balanced">Balanced</option>
              <option value="reliability">Reliability (P90)</option>
            </select>
          </label>
          <div className="md:col-span-2 flex items-end gap-2 flex-wrap">
            <button className="btn-primary" onClick={() => create.mutate()} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Route size={16} /> Generate plan
                </>
              )}
            </button>
            <button className="btn-secondary" disabled={!planId} onClick={() => approve.mutate()}>
              <CheckCircle2 size={16} /> Approve
            </button>
            <button className="btn-secondary" disabled={!planId} onClick={() => publish.mutate()}>
              Publish trips
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-navy/[0.06]">
          {(["time", "distance", "vehicles", "reliability"] as const).map((k) => (
            <label key={k}>
              <span className="label">{k} weight</span>
              <input
                className="input"
                type="number"
                value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </div>

      {job && plan?.status === "generating" && (
        <div className="card card-body flex items-center gap-3 text-sm">
          <Loader2 size={18} className="animate-spin text-route" />
          <div>
            <span className="font-semibold">Solver running</span> — {job.progress}% · {job.message}
          </div>
          <div className="flex-1 h-2 rounded-full bg-canvas overflow-hidden ml-2 max-w-xs">
            <div className="h-full bg-route rounded-full transition-all" style={{ width: `${job.progress}%` }} />
          </div>
        </div>
      )}

      {err && (
        <p role="alert" className="text-bad bg-red-50 rounded-xl p-3 border border-red-100 text-sm">
          {err}
        </p>
      )}

      {plan?.status === "failed" && (
        <div role="alert" className="card card-body border-bad/30 bg-red-50/50">
          <h2 className="font-bold text-bad">Plan is infeasible</h2>
          <ul className="list-disc ml-5 text-sm mt-2 text-slate">
            {(plan.infeasibility?.reasons || ["Solver failed"]).map((r: string) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {plan && plan.status !== "failed" && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(plan.aggregate_metrics || {})
              .filter(([k]) => ["routes", "total_distance_km", "average_on_time", "vehicles_used"].includes(k))
              .map(([k, v]) => (
                <StatCard key={k} label={k.replaceAll("_", " ")} value={String(v)} icon={Map} />
              ))}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 pt-5 pb-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-ink">Route preview</h2>
              <div className="flex items-center gap-4 text-xs font-medium text-slate">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={showCorridors}
                    onChange={(e) => setShowCorridors(e.target.checked)}
                  />
                  <ShieldAlert size={14} className="text-bad" /> Vision Zero corridors
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={showConstruction}
                    onChange={(e) => setShowConstruction(e.target.checked)}
                  />
                  <Construction size={14} className="text-warn" /> Active construction
                </label>
              </div>
            </div>
            <RouteMap
              points={[...points, ...hazardPoints]}
              lines={[...lines, ...hazardLines]}
              className="h-[28rem] rounded-none border-0 border-t border-navy/[0.06]"
            />
            <p className="text-[11px] text-muted px-5 py-2 border-t border-navy/[0.06]">
              Corridors and closures are from Louisville Metro / LOJIC open data (data.louisvilleky.gov), scoped to this
              plan's stops — not a live traffic feed.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="section-title">Routes ({routes.length})</h2>
            {routes.map(
              (
                r: {
                  id: string;
                  route_code: string;
                  student_count: number;
                  on_time_probability: number;
                  risk_factors: RiskFactor[];
                  safety_context?: SafetyContext;
                  stops: { id: string; sequence: number; name: string; student_count: number }[];
                },
                i: number,
              ) => (
                <article key={r.id} className="card card-body">
                  <div className="flex flex-wrap justify-between gap-2 items-start">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <h3 className="font-bold text-lg">{r.route_code}</h3>
                    </div>
                    <span className="badge-neutral">
                      {r.student_count} students · {(r.on_time_probability * 100).toFixed(0)}% on-time
                    </span>
                  </div>
                  <ol className="text-sm mt-3 space-y-1 ml-1">
                    {r.stops.map((s) => (
                      <li key={s.id} className="flex gap-2 text-slate">
                        <span className="text-muted font-mono text-xs w-5">{s.sequence}.</span>
                        <span>
                          {s.name}
                          {s.student_count ? ` (${s.student_count})` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <RiskFactorList factors={r.risk_factors} className="mt-3 space-y-1.5" />
                </article>
              ),
            )}
          </div>
        </>
      )}

      <div className="card card-body">
        <h2 className="section-title !mb-4">Existing plans</h2>
        <div className="flex flex-wrap gap-2">
          {planList.map((p: { id: string; name: string; status: string; optimization_mode: string }) => (
            <button
              key={p.id}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                planId === p.id
                  ? "bg-route text-white border-route shadow-sm"
                  : "bg-white text-ink border-slate/15 hover:border-route/30"
              }`}
              onClick={() => setPlanId(p.id)}
            >
              {p.name}
              <span className="opacity-70 font-normal ml-1">· {p.optimization_mode}</span>
            </button>
          ))}
          {planList.length === 0 && <p className="text-slate text-sm">No plans yet — generate one above.</p>}
        </div>
      </div>
    </div>
  );
}
