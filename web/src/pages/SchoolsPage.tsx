import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPinCheck, Plus, Search } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { RouteMap } from "../components/maps/RouteMap";
import { LoadingBlock } from "../components/ui/LoadingBlock";
import { PageHeader } from "../components/ui/PageHeader";
import type { PublicSchoolSite } from "../types";

const LEVEL_TO_TYPE: Record<string, string> = { E: "elementary", M: "middle", H: "high" };

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
                      <Link className="link" to={`/app/schools/${s.id}`}>
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
  const [lookup, setLookup] = useState("");
  const { data: matches } = useQuery({
    queryKey: ["geodata", "schools", lookup],
    enabled: lookup.trim().length >= 2,
    queryFn: async () => (await api.get("/geodata/schools/", { params: { search: lookup, page_size: 8 } })).data,
  });

  function applyRealSchool(s: PublicSchoolSite) {
    setForm({
      ...form,
      name: s.name,
      address: [s.address, s.city, s.state, s.zip_code].filter(Boolean).join(", "),
      latitude: String(s.latitude),
      longitude: String(s.longitude),
      school_type: LEVEL_TO_TYPE[s.level] || form.school_type,
    });
    setLookup("");
  }

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

        <div className="relative">
          <label className="label" htmlFor="school-lookup">
            <MapPinCheck size={14} className="inline -mt-0.5 mr-1 text-good" />
            Find a real Jefferson County school (optional)
          </label>
          <input
            id="school-lookup"
            className="input"
            placeholder="Start typing a school name…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            autoComplete="off"
          />
          {matches?.results?.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white border border-line rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {matches.results.map((s: PublicSchoolSite) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-canvas"
                    onClick={() => applyRealSchool(s)}
                  >
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted">{s.address}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted mt-1">
            Fills in name, address, and coordinates from Louisville Metro/LOJIC open data. Bell times and school code
            still need your input.
          </p>
        </div>

        <div className="grid gap-3 mt-3">
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
