import { AlertTriangle, CheckCircle2, CloudSnow, Construction, ShieldAlert } from "lucide-react";
import type { RiskFactor } from "../../types";

// Safety-critical factors (real Louisville crash/construction data) get the
// red treatment; scheduling factors stay amber; STABLE is the only green one.
const FACTOR_STYLE: Record<string, { icon: typeof AlertTriangle; className: string }> = {
  HIGH_INJURY_CORRIDOR: { icon: ShieldAlert, className: "text-bad bg-red-50 border-red-100" },
  ACTIVE_CONSTRUCTION: { icon: Construction, className: "text-bad bg-red-50 border-red-100" },
  LOW_SNOW_PRIORITY: { icon: CloudSnow, className: "text-warn bg-amber-50 border-amber-100" },
  STABLE: { icon: CheckCircle2, className: "text-good bg-emerald-50 border-emerald-100" },
};
const DEFAULT_FACTOR_STYLE = { icon: AlertTriangle, className: "text-warn bg-amber-50 border-amber-100" };

export const SAFETY_FACTOR_CODES = ["HIGH_INJURY_CORRIDOR", "ACTIVE_CONSTRUCTION", "LOW_SNOW_PRIORITY", "STABLE"];

export function RiskFactorList({
  factors,
  onlyCodes,
  className = "space-y-1.5",
}: {
  factors: RiskFactor[] | undefined;
  /** Restrict to specific factor codes, e.g. SAFETY_FACTOR_CODES for a guardian-facing view. */
  onlyCodes?: string[];
  className?: string;
}) {
  const list = (onlyCodes ? (factors || []).filter((f) => onlyCodes.includes(f.code)) : factors) || [];
  if (!list.length) return null;
  return (
    <div className={className}>
      {list.map((f) => {
        const style = FACTOR_STYLE[f.code] || DEFAULT_FACTOR_STYLE;
        const Icon = style.icon;
        return (
          <p key={f.code} className={`text-xs flex items-start gap-1.5 rounded-lg px-3 py-2 border ${style.className}`}>
            <Icon size={14} className="shrink-0 mt-0.5" />
            <span>{f.text}</span>
          </p>
        );
      })}
    </div>
  );
}
