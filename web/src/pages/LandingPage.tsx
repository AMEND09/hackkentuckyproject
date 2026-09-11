import { Link } from "react-router-dom";
import { ArrowRight, GitCompare, Radio, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Logo, LogoMark } from "../components/brand/Logo";
import { ROLE_HOME } from "../types";

const features = [
  {
    icon: Waypoints,
    title: "Automated routing",
    body: "A capacitated vehicle-routing solver builds bus routes around capacity, wheelchair seats, and bell-time windows.",
  },
  {
    icon: Sparkles,
    title: "Predicted travel time",
    body: "Quantile models estimate P50/P90 leg durations and late-arrival risk, feeding the optimizer and every live ETA.",
  },
  {
    icon: GitCompare,
    title: "Fastest vs. reliable",
    body: "Generate plans in Fastest, Balanced, or Reliability mode and compare mileage, ride time, and on-time probability.",
  },
  {
    icon: Radio,
    title: "Live tracking",
    body: "Dispatchers watch the fleet, get delay alerts, and families see a private ETA for their own children.",
  },
];

const steps = [
  { n: "01", label: "Import district data", body: "Schools, students, stops, vehicles, and drivers." },
  { n: "02", label: "Generate & compare plans", body: "Solve routes, then weigh speed against reliability." },
  { n: "03", label: "Stress-test the morning", body: "A Monte Carlo digital twin simulates traffic and weather." },
  { n: "04", label: "Dispatch & track", body: "Live ETAs update as the buses move." },
];

const stats = [
  { value: "P50 / P90", label: "Travel-time quantiles" },
  { value: "3", label: "Optimization modes" },
  { value: "1,000", label: "Simulated mornings" },
];

export function LandingPage() {
  const { user } = useAuth();
  const primaryTo = user ? ROLE_HOME[user.role] : "/login";
  const primaryLabel = user ? "Open the console" : "Enter the demo";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" aria-label="DART home">
            <Logo size={26} />
          </Link>
          <nav className="flex items-center gap-6">
            <a href="#features" className="hidden sm:inline text-sm font-medium text-slate hover:text-ink transition-colors">
              Features
            </a>
            <a href="#how" className="hidden sm:inline text-sm font-medium text-slate hover:text-ink transition-colors">
              How it works
            </a>
            {!user && (
              <Link to="/login" className="hidden sm:inline text-sm font-medium text-slate hover:text-ink transition-colors">
                Sign in
              </Link>
            )}
            <Link to={user ? primaryTo : "/register"} className="btn-primary !py-2 text-sm">
              {user ? "Open console" : "Create account"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-slate">
              <ShieldCheck size={14} className="text-route" /> Fictional data · Synthetic ML · Safe to demo
            </span>
            <h1 className="mt-6 font-display text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-ink">
              District Automated <span className="text-route">Routing &amp; Tracking</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate leading-relaxed">
              DART plans routes with an optimization solver, predicts travel time and delay risk, stress-tests the
              morning, and gives families a private ETA — one precise transportation console.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={primaryTo} className="btn-primary !py-3 !px-6 text-sm">
                {primaryLabel} <ArrowRight size={16} />
              </Link>
              {!user && (
                <Link to="/register" className="btn-secondary !py-3 !px-6 text-sm">
                  Create an account
                </Link>
              )}
              <a href="#how" className="btn-secondary !py-3 !px-6 text-sm">
                See how it works
              </a>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl font-bold tracking-tight text-ink tabular-nums">{s.value}</div>
                  <div className="mt-1 text-xs text-slate leading-snug">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand panel (uses the dart mark on brand-black) */}
          <div className="relative hidden lg:block">
            <div className="rounded-2xl bg-navy p-12 shadow-float flex flex-col items-center justify-center aspect-[4/3]">
              <LogoMark size={128} />
              <div className="mt-8 font-display text-4xl font-bold tracking-[0.2em] text-white">DART</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">Routing &amp; Tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Everything a morning needs</h2>
          <p className="mt-3 text-slate">
            DART combines classical optimization with synthetic ML so districts can plan, compare, and operate routes
            end to end.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card card-body flex flex-col gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-route">
                  <Icon size={20} />
                </span>
                <h3 className="font-display font-semibold text-lg tracking-tight">{f.title}</h3>
                <p className="text-sm text-slate leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-paper border-y border-line">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">From data to dispatch</h2>
            <p className="mt-3 text-slate">Four steps — the same loop the demo walks through.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line bg-canvas p-6">
                <div className="font-display text-2xl font-bold text-route tabular-nums">{s.n}</div>
                <h3 className="mt-2 font-display font-semibold tracking-tight">{s.label}</h3>
                <p className="mt-1.5 text-sm text-slate leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link to={primaryTo} className="btn-primary !py-3 !px-6 text-sm">
              {primaryLabel} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="card card-body lg:p-12 text-center flex flex-col items-center">
          <LogoMark size={40} />
          <h2 className="mt-5 font-display text-2xl lg:text-3xl font-bold tracking-tight">Try it with a demo account</h2>
          <p className="mt-3 max-w-xl text-slate">
            Sign in with any seeded role — district admin, planner, dispatcher, driver, or guardian. All data is
            fictional and the ML is trained only on synthetic segments.
          </p>
          <Link to="/login" className="mt-7 btn-primary !py-3 !px-6 text-sm">
            Go to sign in <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate">
          <Logo size={20} />
          <p>Proof of concept · Not a production student transportation system · Do not use to navigate a real bus.</p>
        </div>
      </footer>
    </div>
  );
}
