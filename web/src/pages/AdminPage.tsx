import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/ui/PageHeader";

function JoinCodeCard({ code, districtName }: { code: string; districtName: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const joinLink = `${window.location.origin}/register`;

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="card card-body">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-route">
          <KeyRound size={16} />
        </span>
        <h2 className="font-bold text-ink">District join code</h2>
      </div>
      <p className="mt-2 text-sm text-slate">
        Share this code with staff and families. When they create an account they choose{" "}
        <span className="font-semibold text-ink">Join a district</span>, enter this code, and pick their role.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-display text-3xl font-bold tracking-[0.2em] tabular-nums text-ink">{code}</span>
        <button type="button" onClick={() => copy(code, "code")} className="btn-secondary !py-2 text-sm">
          {copied === "code" ? <Check size={15} className="text-good" /> : <Copy size={15} />}
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button type="button" onClick={() => copy(joinLink, "link")} className="btn-ghost !py-2 text-sm">
          {copied === "link" ? <Check size={15} className="text-good" /> : <Copy size={15} />}
          {copied === "link" ? "Link copied" : "Copy sign-up link"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Anyone with this code can request to join {districtName}. Rotate it by contacting support if it is shared too
        widely.
      </p>
    </section>
  );
}

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

      {district?.join_code && <JoinCodeCard code={district.join_code} districtName={district.name} />}

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
