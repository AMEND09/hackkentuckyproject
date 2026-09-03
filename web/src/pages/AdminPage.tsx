import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader } from "../components/ui/PageHeader";

export function AdminPage() {
  const qc = useQueryClient();
  const { data: districts } = useQuery({ queryKey: ["districts"], queryFn: async () => (await api.get("/districts/")).data });
  const district = districts?.results?.[0];
  const { data: policy } = useQuery({
    queryKey: ["policy", district?.id],
    enabled: Boolean(district?.id),
    queryFn: async () => (await api.get("/policies/")).data,
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get("/users/")).data });
  const { data: models } = useQuery({ queryKey: ["ml"], queryFn: async () => (await api.get("/model-artifacts/metrics/")).data });
  const { data: audit } = useQuery({ queryKey: ["audit"], queryFn: async () => (await api.get("/audit-logs/")).data });
  const pol = policy?.results?.[0];
  const save = useMutation({
    mutationFn: (body: Record<string, number>) => api.patch(`/policies/${pol.id}/`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy"] }),
  });
  return (
    <div className="page-shell">
      <PageHeader title="Administration" subtitle="District settings, users, ML metrics, and audit trail." />

      {district && (
        <section className="card card-body">
          <h2 className="font-bold text-ink">{district.name}</h2>
          <p className="text-sm text-slate mt-1">
            {district.state} · {district.timezone} · {district.contact_email}
          </p>
        </section>
      )}

      {pol && (
        <section className="card card-body space-y-3">
          <h2 className="font-bold text-ink">Transportation policy</h2>
          <label className="label">Max ride minutes</label>
          <input
            className="input max-w-xs"
            type="number"
            defaultValue={pol.max_student_ride_minutes}
            onBlur={(e) => save.mutate({ max_student_ride_minutes: Number(e.target.value) })}
          />
        </section>
      )}

      <section className="card card-body">
        <h2 className="font-bold text-ink mb-4">Users</h2>
        <div className="data-table-wrap !shadow-none !border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {(users?.results || []).map((u: { id: string; email: string; role: string }) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.email}</td>
                  <td>
                    <span className="badge-neutral capitalize">{u.role.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-body">
        <h2 className="font-bold text-ink">Model metrics</h2>
        <p className="text-sm text-warn mt-2 mb-4 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">{models?.disclaimer}</p>
        {(models?.models || []).map((m: { id: string; model_type: string; metrics: Record<string, unknown> }) => (
          <div key={m.id} className="border-t border-navy/[0.06] py-4 first:border-0 first:pt-0">
            <div className="font-semibold text-sm">{m.model_type}</div>
            <pre className="text-xs overflow-auto mt-2 bg-canvas rounded-xl p-3 text-slate">{JSON.stringify(m.metrics, null, 2)}</pre>
          </div>
        ))}
      </section>

      <section className="card card-body">
        <h2 className="font-bold text-ink mb-4">Activity log</h2>
        <ul className="space-y-2 text-sm">
          {(audit?.results || []).slice(0, 12).map((a: { id: string; action: string; actor_email: string; created_at: string }) => (
            <li key={a.id} className="flex gap-3 py-2 border-b border-navy/[0.04] last:border-0">
              <span className="text-muted text-xs tabular-nums shrink-0 w-36">{a.created_at}</span>
              <span className="font-medium">{a.actor_email}</span>
              <span className="text-slate">{a.action}</span>
            </li>
          ))}
          {(audit?.results || []).length === 0 && <li className="text-slate">No audit events yet.</li>}
        </ul>
      </section>
    </div>
  );
}
