import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Logo } from "./Logo";

const STEPS = [
  { at: 0, label: "Reading riders and fleet", detail: "Stops, vehicles, and bell windows for this school only." },
  { at: 12, label: "Building the travel matrix", detail: "Street distances with P50 and P90 travel times." },
  { at: 40, label: "Solving vehicle routing", detail: "OR-Tools is assigning buses under capacity and time windows." },
  { at: 88, label: "Writing routes and ETAs", detail: "On-time odds and stop sequences for the map." },
] as const;

const MODE_COPY: Record<string, string> = {
  fastest: "Fastest · P50 travel",
  balanced: "Balanced",
  reliability: "Reliability · P90 travel",
};

const ROUTE_1 = "M48 392 L168 392 L168 268 L328 268 L328 156 L568 156";
const EXIT_MS = 720;

export function PlanGeneratingScreen({
  open,
  progress,
  message,
  mode,
  schoolName,
}: {
  open: boolean;
  progress?: number;
  message?: string;
  mode: string;
  schoolName?: string;
}) {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const shown = useSmoothProgress(open, progress);

  useEffect(() => {
    if (open) {
      setPhase("in");
      return;
    }
    if (phase !== "in") return;
    setPhase("out");
    const t = window.setTimeout(() => setPhase("hidden"), EXIT_MS);
    return () => window.clearTimeout(t);
    // phase is only used to decide whether we need an exit beat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase === "hidden") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const stepIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < STEPS.length; i += 1) {
      if (shown >= STEPS[i].at) idx = i;
    }
    return idx;
  }, [shown]);

  const riders = Math.round((shown / 100) * 186);
  const stops = Math.round((shown / 100) * 24);
  const buses = Math.min(8, Math.max(1, Math.round((shown / 100) * 8)));

  if (phase === "hidden" || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`dart-plan-gen ${phase === "out" ? "is-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dart-plan-gen-title"
      aria-describedby="dart-plan-gen-copy"
    >
      <div className="dart-plan-gen-glow" aria-hidden />
      <div className="dart-plan-map-wrap">
        <SolverMap progress={shown} />
      </div>

      <div className="dart-plan-gen-panel">
        <Logo size={28} tone="white" showTagline />

        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300/80">
          {MODE_COPY[mode] || "Route plan"}
          {schoolName ? ` · ${schoolName}` : ""}
        </p>
        <h2 id="dart-plan-gen-title" className="mt-3 font-display text-[clamp(32px,4vw,48px)] font-bold leading-[1.05] tracking-tight text-white">
          Building your morning
        </h2>
        <p id="dart-plan-gen-copy" className="mt-3 max-w-[28em] text-[15px] leading-relaxed text-white/60">
          DART is assigning riders to buses. Other students stay off this plan.
        </p>

        <ol className="mt-8 space-y-3.5" aria-live="polite">
          {STEPS.map((step, i) => {
            const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "todo";
            return (
              <li key={step.label} className={`dart-plan-step is-${state}`}>
                <span className="dart-plan-step-mark" aria-hidden>
                  {state === "done" ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.2 L4.6 8.8 L10 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="dart-plan-step-dot" />
                  )}
                </span>
                <span>
                  <span className="block text-[14.5px] font-semibold">{step.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-white/45">{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="font-medium text-white/55">{message || STEPS[stepIndex].label}</span>
            <span className="font-display text-lg font-bold tabular-nums text-white">{shown}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="dart-plan-bar h-full rounded-full" style={{ width: `${shown}%` }} />
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
          <Stat label="Riders" value={riders} />
          <Stat label="Stops" value={stops} />
          <Stat label="Buses" value={buses} />
        </dl>

        <p className="mt-8 text-[11.5px] text-white/35">Private to this district · Demo solver · Fictional riders</p>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-white">{value}</dd>
    </div>
  );
}

function SolverMap({ progress }: { progress: number }) {
  const lit = Math.min(6, Math.max(1, Math.round((progress / 100) * 6)));
  return (
    <svg
      className="dart-plan-map"
      viewBox="0 0 640 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="dartPlanFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0B1120" stopOpacity="0" />
          <stop offset="72%" stopColor="#0B1120" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0B1120" stopOpacity="0.92" />
        </linearGradient>
        <filter id="dartPlanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="640" height="520" fill="#0B1120" />
      <g stroke="rgba(255,255,255,.055)" strokeWidth="1.2">
        <path d="M0 104H640M0 208H640M0 312H640M0 416H640M96 0V520M208 0V520M320 0V520M432 0V520M544 0V520" />
      </g>

      <path d={ROUTE_1} className="dart-solve-ghost" />
      <path d="M48 352 L208 352 L208 208 L412 208 L412 112 L568 112" className="dart-solve-ghost" />
      <path d="M80 432 L292 432 L292 300 L492 300 L492 200 L568 200" className="dart-solve-ghost" />

      <path d={ROUTE_1} className="dart-solve-route dart-solve-r1" filter="url(#dartPlanGlow)" />
      <path d="M48 352 L208 352 L208 208 L412 208 L412 112 L568 112" className="dart-solve-route dart-solve-r2" />
      <path d="M80 432 L292 432 L292 300 L492 300 L492 200 L568 200" className="dart-solve-route dart-solve-r3" />

      {[
        [168, 392],
        [168, 268],
        [328, 268],
        [328, 156],
        [208, 208],
        [412, 208],
      ].map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="5.5"
          className={`dart-solve-stop ${i < lit ? "is-lit" : ""}`}
        />
      ))}

      <g className="dart-solve-dart">
        <circle r="16" fill="#2563EB" opacity=".18" />
        <circle r="10" fill="#2563EB" />
        <path d="M0 -5.5 L5 5 L0 2.2 L-5 5 Z" fill="#fff" />
      </g>

      <g transform="translate(568 144)">
        <rect x="-13" y="-13" width="26" height="26" rx="5" fill="#fff" />
        <path d="M-6 4 L-6 -3 L0 -7 L6 -3 L6 4 Z" fill="#0B1120" />
      </g>

      <rect width="640" height="520" fill="url(#dartPlanFade)" />
    </svg>
  );
}

function useSmoothProgress(open: boolean, reported?: number) {
  const [shown, setShown] = useState(6);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      started.current = null;
      return;
    }
    if (started.current == null) started.current = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - (started.current || performance.now());
      const t = Math.min(elapsed / 14000, 1);
      const estimated = 6 + 76 * (1 - (1 - t) * (1 - t));
      const target = reported != null && reported >= 100 ? 100 : Math.max(reported ?? 0, estimated);
      setShown((prev) => {
        const next = prev + (target - prev) * 0.14;
        return Math.abs(next - target) < 0.2 ? target : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, reported]);

  return Math.round(shown);
}
