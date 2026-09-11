import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { errorMessage } from "../api/client";
import { Logo, LogoMark } from "../components/brand/Logo";
import { ROLE_HOME } from "../types";

const schema = z
  .object({
    district_name: z.string().min(2, "Enter your district or organization name"),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type Form = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerAccount, user } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      district_name: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
    },
  });

  useEffect(() => {
    if (user) nav(ROLE_HOME[user.role], { replace: true });
  }, [user, nav]);

  async function onSubmit(values: Form) {
    setError(null);
    try {
      const u = await registerAccount({
        district_name: values.district_name,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
      nav(ROLE_HOME[u.role], { replace: true });
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
            Set up your district in minutes
          </h1>
          <p className="mt-5 max-w-md text-base text-white/70 leading-relaxed">
            Create an account, import your roster from CSV, and generate your first route plan the same day.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/70">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                <Navigation size={17} />
              </span>
              Your workspace is created instantly
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                <MapPin size={17} />
              </span>
              Guided CSV onboarding with starter data
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                <ShieldCheck size={17} />
              </span>
              You are the district administrator
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
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-ink transition-colors mb-4"
            >
              <ArrowLeft size={14} /> Back to home
            </Link>
            <h2 className="font-display text-2xl font-bold tracking-tight">Create your account</h2>
            <p className="text-sm text-slate mt-1">This creates a new district workspace and makes you its admin.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-bad bg-bad/5 rounded-lg p-3 border border-bad/20">
              {error}
            </p>
          )}

          <div>
            <label className="label" htmlFor="district_name">
              District / organization name
            </label>
            <input id="district_name" className="input" type="text" {...form.register("district_name")} />
            {form.formState.errors.district_name && (
              <p className="text-sm text-bad mt-1">{form.formState.errors.district_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="first_name">
                First name
              </label>
              <input id="first_name" className="input" type="text" autoComplete="given-name" {...form.register("first_name")} />
              {form.formState.errors.first_name && (
                <p className="text-sm text-bad mt-1">{form.formState.errors.first_name.message}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="last_name">
                Last name
              </label>
              <input id="last_name" className="input" type="text" autoComplete="family-name" {...form.register("last_name")} />
              {form.formState.errors.last_name && (
                <p className="text-sm text-bad mt-1">{form.formState.errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input id="email" className="input" type="email" autoComplete="username" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-bad mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Phone <span className="text-muted font-normal normal-case">(optional)</span>
            </label>
            <input id="phone" className="input" type="tel" autoComplete="tel" {...form.register("phone")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-bad mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                {...form.register("confirm")}
              />
              {form.formState.errors.confirm && (
                <p className="text-sm text-bad mt-1">{form.formState.errors.confirm.message}</p>
              )}
            </div>
          </div>

          <button className="btn-primary w-full !py-3" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating account…" : "Create account"}
          </button>

          <p className="text-sm text-slate text-center">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-route hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
