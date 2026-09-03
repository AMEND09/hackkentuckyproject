import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { PageHeader } from "../components/ui/PageHeader";

const TYPES = ["schools", "students", "drivers", "vehicles", "stops"] as const;

export function OnboardingPage() {
  const [kind, setKind] = useState<(typeof TYPES)[number]>("students");
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [mapping, setMapping] = useState<Record<string, { header: string | null }>>({});
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("import_type", kind);
      const { data } = await api.post("/imports/upload/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      return data;
    },
    onSuccess: (data) => {
      setJob(data);
      const proposed = (data.proposed_column_mapping?.mapping || {}) as Record<string, { header: string | null }>;
      setMapping(proposed);
      setErr(null);
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const confirm = useMutation({
    mutationFn: async () => (await api.post(`/imports/${job?.id}/confirm-mapping/`, { mapping })).data,
    onSuccess: setJob,
    onError: (e) => setErr(errorMessage(e)),
  });
  const commit = useMutation({
    mutationFn: async () => (await api.post(`/imports/${job?.id}/commit/`)).data,
    onSuccess: setJob,
    onError: (e) => setErr(errorMessage(e)),
  });

  const errors = (job?.row_errors as Array<{ id: string; row_number: number; field: string; message: string }>) || [];

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        title="District onboarding"
        subtitle="Upload CSV files, confirm column mapping, and commit roster data."
      />

      <ol className="card card-body text-sm text-slate space-y-2 list-decimal ml-5">
        <li>Create district profile (seeded for the demo)</li>
        <li>Upload CSV files and confirm column mapping</li>
        <li>Review row errors, then commit</li>
        <li>Generate the first route plan from the planner</li>
      </ol>

      <div className="flex gap-2 flex-wrap">
        {TYPES.map((t) => (
          <button key={t} className={kind === t ? "btn-primary capitalize" : "btn-secondary capitalize"} onClick={() => setKind(t)}>
            {t}
          </button>
        ))}
        <a className="btn-secondary" href={`http://localhost:8000/api/v1/imports/templates/${kind}/`}>
          <Download size={16} /> Template
        </a>
      </div>

      <label className="card card-body block cursor-pointer border-dashed border-2 border-slate/20 hover:border-route/40 hover:bg-accent-soft/30 transition">
        <span className="label flex items-center gap-2 !normal-case !tracking-normal">
          <Upload size={16} /> Upload {kind} CSV
        </span>
        <input
          type="file"
          accept=".csv"
          className="text-sm text-slate mt-2"
          aria-label={`Upload ${kind} CSV`}
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
        />
      </label>

      {err && (
        <p role="alert" className="text-bad bg-red-50 rounded-xl p-3 border border-red-100 text-sm">
          {err}
        </p>
      )}

      {job && (
        <div className="card card-body space-y-4">
          <div>
            <h2 className="font-bold text-ink">
              {(job.original_filename as string) || "Import file"}
            </h2>
            <p className="text-xs text-slate mt-1">
              Status: <span className="font-semibold capitalize">{String(job.status)}</span> · Heuristic mapper (no LLM)
            </p>
          </div>
          <div className="data-table-wrap !shadow-none !border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>CSV column</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mapping).map(([field, m]) => (
                  <tr key={field}>
                    <td className="font-medium">{field}</td>
                    <td>
                      <select
                        className="select"
                        value={m.header || ""}
                        onChange={(e) => setMapping({ ...mapping, [field]: { header: e.target.value || null } })}
                        aria-label={`Map ${field}`}
                      >
                        <option value="">— not mapped —</option>
                        {((job.headers as string[]) || []).map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-slate text-xs">
                      {String(((job.proposed_column_mapping as { examples?: Record<string, string[]> })?.examples || {})[field]?.[0] || "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              Validate mapping
            </button>
            <button className="btn-primary" onClick={() => commit.mutate()} disabled={commit.isPending}>
              Commit import
            </button>
            <a className="btn-secondary" href={`http://localhost:8000/api/v1/imports/${job.id}/errors.csv/`}>
              Download errors
            </a>
          </div>
          {errors.length > 0 && (
            <ul className="text-sm text-bad list-disc ml-5 bg-red-50 rounded-xl p-4 border border-red-100">
              {errors.slice(0, 12).map((e) => (
                <li key={e.id}>
                  Row {e.row_number} {e.field}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
