type Tone = "good" | "warn" | "bad" | "info" | "neutral";

const TONE_STYLES: Record<Tone, { wrap: string; dot: string }> = {
  good: { wrap: "bg-good/10 text-good border-good/25", dot: "bg-good" },
  warn: { wrap: "bg-warn/10 text-warn border-warn/25", dot: "bg-warn" },
  bad: { wrap: "bg-bad/10 text-bad border-bad/25", dot: "bg-bad" },
  info: { wrap: "bg-accent-soft text-route border-route/25", dot: "bg-route" },
  neutral: { wrap: "bg-canvas text-slate border-line", dot: "bg-slate" },
};

// Normalize a raw status string to a tone + human label.
function resolve(status: string): { tone: Tone; label: string } {
  const s = status.toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, { tone: Tone; label: string }> = {
    on_route: { tone: "good", label: "On route" },
    en_route: { tone: "good", label: "On route" },
    in_progress: { tone: "good", label: "On route" },
    active: { tone: "good", label: "Active" },
    boarding: { tone: "good", label: "Boarding" },
    delayed: { tone: "warn", label: "Delayed" },
    late: { tone: "warn", label: "Delayed" },
    at_risk: { tone: "warn", label: "At risk" },
    completed: { tone: "neutral", label: "Completed" },
    arrived: { tone: "neutral", label: "Arrived" },
    done: { tone: "neutral", label: "Completed" },
    scheduled: { tone: "neutral", label: "Scheduled" },
    pending: { tone: "neutral", label: "Pending" },
    not_started: { tone: "neutral", label: "Not started" },
    generated: { tone: "info", label: "Generated" },
    draft: { tone: "neutral", label: "Draft" },
    cancelled: { tone: "bad", label: "Cancelled" },
    canceled: { tone: "bad", label: "Cancelled" },
    failed: { tone: "bad", label: "Failed" },
    critical: { tone: "bad", label: "Critical" },
  };
  return map[s] ?? { tone: "neutral", label: status.replace(/_/g, " ") };
}

export function StatusBadge({
  status,
  label,
  tone,
  className = "",
}: {
  status: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const resolved = resolve(status);
  const t = tone ?? resolved.tone;
  const styles = TONE_STYLES[t];
  return (
    <span className={`status ${styles.wrap} ${className}`}>
      <span className={`status-dot ${styles.dot}`} aria-hidden />
      <span className="capitalize">{label ?? resolved.label}</span>
    </span>
  );
}
