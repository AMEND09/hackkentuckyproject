import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { api, errorMessage } from "../api/client";
import { AuthBrandPanel } from "../components/brand/AuthBrandPanel";
import { Logo } from "../components/brand/Logo";
import { afterSignInPath, ROLE_HOME, type Role } from "../types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password is required"),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const justSignedIn = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demo, setDemo] = useState<{ password: string; accounts: { email: string; label: string; role: Role }[] } | null>(
    null,
  );
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (user && !justSignedIn.current) nav(ROLE_HOME[user.role], { replace: true });
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
      justSignedIn.current = true;
      nav(afterSignInPath(u.role, { pickWorkspace: true }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <AuthBrandPanel
        heading="District Automated Routing & Tracking"
        sub="Routes, live bus tracking, and transportation updates in one coordinated view."
      />

      <section className="flex items-start justify-center overflow-y-auto p-8 lg:items-center lg:p-16">
        <div className="w-full max-w-[404px] animate-slide-up py-2">
          <div className="mb-4 lg:hidden">
            <Logo size={26} />
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-2 text-[14.5px] text-slate">Use your district email, or open a demo account.</p>

          <form className="mt-7 flex flex-col gap-[18px]" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && (
              <p role="alert" className="rounded-lg border border-bad/20 bg-bad/5 p-3 text-sm text-bad">
                {error}
              </p>
            )}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@district.org"
                autoComplete="username"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-sm text-bad">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label className="label !mb-0" htmlFor="password">
                  Password
                </label>
                <span className="text-[12.5px] font-semibold text-route">Forgot?</span>
              </div>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-sm text-bad">{form.formState.errors.password.message}</p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-slate">
              <input type="checkbox" className="h-4 w-4 accent-route" />
              Keep me signed in on this device
            </label>
            <button className="btn-primary w-full !py-3.5 !text-[15px]" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-[13.5px] text-slate">
              New district?{" "}
              <Link to="/register" className="font-semibold text-route hover:underline">
                Create an account
              </Link>
            </p>
          </form>

          {demo && (
            <div className="mt-6 border-t border-line pt-5">
              <button
                type="button"
                onClick={() => setDemoOpen((o) => !o)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-paper px-3.5 py-3 text-left text-[13.5px] font-semibold transition-colors hover:bg-canvas"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent-soft text-route">
                  <ChevronDown size={13} className={`transition-transform ${demoOpen ? "rotate-180" : ""}`} />
                </span>
                Open a demo account
                <span className="ml-auto text-[11.5px] font-semibold text-slate">{demoOpen ? "Hide" : "Show"}</span>
              </button>
              {demoOpen && (
                <div className="mt-3 rounded-xl border border-line bg-paper p-3.5">
                  <p className="mb-3 text-[12.5px] text-slate">
                    Each role opens a different part of the demo. All data is fictional.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {demo.accounts.map((a) => (
                      <button
                        key={a.email}
                        type="button"
                        onClick={() => onSubmit({ email: a.email, password: demo.password })}
                        className="min-h-11 rounded-lg border border-line bg-canvas px-2.5 py-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-route hover:text-route"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
