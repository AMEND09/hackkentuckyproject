import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Bus, MapPin, Shield } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { api, errorMessage } from "../api/client";
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
      <section className="relative overflow-hidden bg-navy text-white p-10 lg:p-16 flex flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(37,99,235,0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold mb-8">
            <Bus size={14} /> Jefferson Demo Schools
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">RouteWise</h1>
          <p className="mt-5 max-w-md text-base text-white/75 leading-relaxed">
            Plan routes, run morning ops, and give families a private ETA — one district console built for demos.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/70">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <MapPin size={17} />
              </span>
              Street-following route guide for drivers
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <Shield size={17} />
              </span>
              Fictional students & synthetic ML — safe to demo
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-white/40">Proof of concept · Not a production system</p>
      </section>
      <section className="p-8 lg:p-16 flex items-center">
        <form
          className="w-full max-w-md mx-auto glass p-8 lg:p-10 space-y-5 animate-slide-up"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-slate mt-1">Use a demo account or your district email.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-bad bg-red-50 rounded-xl p-3 border border-red-100">
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
          {demo && (
            <div className="pt-4 border-t border-navy/[0.06]">
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
