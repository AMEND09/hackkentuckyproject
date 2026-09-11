import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { api, errorMessage } from "../api/client";
import { Logo, LogoMark } from "../components/brand/Logo";
import { ROLE_HOME, type Role } from "../types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password is required"),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ password: string; accounts: { email: string; label: string; role: Role }[] } | null>(
    null,
  );
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (user) nav(ROLE_HOME[user.role], { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (import.meta.env.VITE_DEMO_MODE === "true") {
      api.get("/auth/demo-credentials/").then((r) => r.data.demo_mode && setDemo(r.data));
    }
  }, []);

  async function onSubmit(values: Form) {
    setError(null);
    try {
      const u = await login(values.email, values.password);
      nav(ROLE_HOME[u.role]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      {/* Brand panel */}
      <section className="relative hidden lg:flex bg-navy text-white p-12 xl:p-16 flex-col justify-between">
        <Logo size={28} tone="white" />
        <div>
          <div className="mb-8">
            <LogoMark size={72} />
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">
            District Automated Routing &amp; Tracking
          </h1>
          <p className="mt-5 max-w-md text-base text-white/70 leading-relaxed">
            Plan routes, run morning operations, and give families a private ETA — one precise transportation console.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/70">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                <Navigation size={17} />
              </span>
              Street-following route guide for drivers
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                <MapPin size={17} />
              </span>
              Live fleet tracking with predicted ETAs
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                <ShieldCheck size={17} />
              </span>
              Fictional students &amp; synthetic ML — safe to demo
            </li>
          </ul>
        </div>
        <p className="text-xs text-white/40">Proof of concept · Not a production system</p>
      </section>

      {/* Form */}
      <section className="p-8 lg:p-16 flex items-center">
        <form
          className="w-full max-w-md mx-auto space-y-5 animate-slide-up"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div className="lg:hidden mb-2">
            <Logo size={26} />
          </div>
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-ink transition-colors mb-4">
              <ArrowLeft size={14} /> Back to home
            </Link>
            <h2 className="font-display text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-slate mt-1">Use a demo account or your district email.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-bad bg-bad/5 rounded-lg p-3 border border-bad/20">
              {error}
            </p>
          )}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" className="input" type="email" autoComplete="username" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-bad mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-bad mt-1">{form.formState.errors.password.message}</p>
            )}
          </div>
          <button className="btn-primary w-full !py-3" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-sm text-slate text-center">
            New district?{" "}
            <Link to="/register" className="font-semibold text-route hover:underline">
              Create an account
            </Link>
          </p>
          {demo && (
            <div className="pt-4 border-t border-line">
              <p className="label !normal-case !tracking-normal !text-slate mb-3">Quick demo login</p>
              <div className="grid grid-cols-2 gap-2">
                {demo.accounts.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    className="btn-secondary text-xs !py-2"
                    onClick={() => onSubmit({ email: a.email, password: demo.password })}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
