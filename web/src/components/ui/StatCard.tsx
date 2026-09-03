import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "sky",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: "sky" | "good" | "warn" | "bad";
}) {
  const iconBg = {
    sky: "bg-sky/10 text-sky",
    good: "bg-emerald-50 text-good",
    warn: "bg-amber-50 text-warn",
    bad: "bg-red-50 text-bad",
  }[accent];

  return (
    <article className="kpi-card pl-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate">{label}</div>
          <div className="kpi-value">{value}</div>
          {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
        </div>
        {Icon && (
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </article>
  );
}
