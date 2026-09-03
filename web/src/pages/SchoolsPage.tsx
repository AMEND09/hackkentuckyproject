import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { RouteMap } from "../components/maps/RouteMap";
import { LoadingBlock } from "../components/ui/LoadingBlock";
import { PageHeader } from "../components/ui/PageHeader";

export function SchoolsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["schools", q],
    queryFn: async () => (await api.get("/schools/", { params: { search: q } })).data,
  });
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: Record<string, string>) => api.post("/schools/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schools"] });
      setOpen(false);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const rows = data?.results || data || [];
  return (
    <div className="page-shell">
      <PageHeader
        title="Schools"
        subtitle="District campuses with bell times and dismissal windows."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add school
          </button>
        }
      />
      <div className="toolbar">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input !pl-10"
            placeholder="Search schools"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search schools"
          />
        </div>
      </div>
      {isLoading ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Bell</th>
                  <th>Dismissal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: { id: string; name: string; school_type: string; morning_bell_time: string; dismissal_time: string }) => (
                  <tr key={s.id}>
                    <td className="font-semibold">
                      <Link className="link" to={`/schools/${s.id}`}>
                        {s.name}
                      </Link>
                    </td>
                    <td className="capitalize text-slate">{s.school_type}</td>
                    <td className="text-slate tabular-nums">{s.morning_bell_time}</td>
                    <td className="text-slate tabular-nums">{s.dismissal_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card overflow-hidden">
            <RouteMap
              points={rows.map((s: { id: string; name: string; latitude: string; longitude: string }) => ({
                id: s.id,
                lat: Number(s.latitude),
                lng: Number(s.longitude),
                label: s.name,
                color: "#059669",
                kind: "place" as const,
              }))}
              className="h-full min-h-80 rounded-none border-0"
            />
          </div>
        </div>
      )}
      {open && (
        <SchoolForm
          error={err}
          onClose={() => setOpen(false)}
          onSubmit={(body) => create.mutate(body)}
          busy={create.isPending}
        />
      )}
    </div>
  );
}

function SchoolForm({
  onSubmit,
  onClose,
  error,
  busy,
}: {
  onSubmit: (b: Record<string, string>) => void;
  onClose: () => void;
  error: string | null;
  busy: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    school_code: "",
    school_type: "elementary",
    address: "",
    latitude: "38.25",
    longitude: "-85.75",
    morning_bell_time: "08:00",
    dismissal_time: "15:00",
  });
  return (
    <div className="modal-backdrop" role="dialog" aria-modal>
      <form
        className="modal-panel max-h-[90vh] overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <h2 className="text-xl font-bold">New school</h2>
        {error && <p className="text-bad text-sm bg-red-50 rounded-xl p-3">{error}</p>}
        <div className="grid gap-3">
          {Object.entries(form).map(([k, v]) => (
            <div key={k}>
              <label className="label" htmlFor={k}>
                {k.replaceAll("_", " ")}
              </label>
              <input
                id={k}
                className="input"
                value={v}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
