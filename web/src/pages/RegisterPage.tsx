import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Check, Users } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { api, errorMessage } from "../api/client";
import { AuthBrandPanel } from "../components/brand/AuthBrandPanel";
import { Logo } from "../components/brand/Logo";
import { ROLE_HOME, type Role } from "../types";

type Mode = "create" | "join";

interface PublicDistrict {
  id: string;
  name: string;
  state: string;
}

const JOIN_ROLES: { value: Role; label: string; body: string }[] = [
  { value: "district_admin", label: "District admin", body: "Schools, fleet, drivers, and settings." },
  { value: "planner", label: "Planner", body: "Build and review route plans." },
  { value: "dispatcher", label: "Dispatcher", body: "Live fleet board and delay handling." },
  { value: "driver", label: "Driver", body: "Assigned route and stop details." },
  { value: "guardian", label: "Family", body: "Arrival estimates for your riders." },
];

const baseFields = {
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  password: z.string().min(8, "At least 8 characters"),
  confirm: z.string(),
};

const createSchema = z
  .object({ ...baseFields, district_name: z.string().min(2, "Enter your district or organization name") })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

const joinSchema = z
  .object({ ...baseFields, role: z.string().min(1, "Choose a role") })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

type CreateForm = z.infer<typeof createSchema>;
type JoinForm = z.infer<typeof joinSchema>;

function passwordStrength(pw: string): { pct: number; label: string; cls: string } {
  if (!pw) return { pct: 0, label: "", cls: "bg-line" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { pct: 33, label: "Weak", cls: "bg-bad" };
  if (score === 3) return { pct: 66, label: "Fair", cls: "bg-warn" };
  return { pct: 100, label: "Strong", cls: "bg-good" };
}

export function RegisterPage() {
  const { register: registerAccount, user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("create");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) nav(ROLE_HOME[user.role], { replace: true });
  }, [user, nav]);

  return (
    <div className="grid min-h-screen bg-canvas lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <AuthBrandPanel
        heading={mode === "create" ? "Set up your district workspace" : "Join your district on DART"}
        sub={
          mode === "create"
            ? "Create an account, add your schools and roster, and build your first route plan."
            : "Enter your district's join code or pick it from the list, then choose how you'll use DART."
        }
      />

      <section className="flex items-start justify-center overflow-y-auto p-8 lg:items-center lg:p-12 xl:p-16">
        <div className="w-full max-w-[460px] animate-slide-up py-2">
          <div className="mb-4 lg:hidden">
            <Logo size={26} />
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-2 text-[14.5px] text-slate">Start a new district workspace, or join one that already exists.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-slate-soft p-1">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                mode === "create" ? "bg-paper text-ink shadow-card" : "text-slate hover:text-ink"
              }`}
            >
              <Building2 size={15} /> Create a district
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                mode === "join" ? "bg-paper text-ink shadow-card" : "text-slate hover:text-ink"
              }`}
            >
              <Users size={15} /> Join a district
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-bad/20 bg-bad/5 p-3 text-sm text-bad">
              {error}
            </p>
          )}

          {mode === "create" ? (
            <CreateForm
              key="create"
              onError={setError}
              onDone={async (values) => {
                await registerAccount({
                  mode: "create",
                  district_name: values.district_name,
                  first_name: values.first_name,
                  last_name: values.last_name,
                  email: values.email,
                  phone: values.phone,
                  password: values.password,
                });
                nav("/app/onboarding", { replace: true });
              }}
            />
          ) : (
            <JoinForm
              key="join"
              onError={setError}
              onDone={async (values, districtId, joinCode) => {
                const u = await registerAccount({
                  mode: "join",
                  role: values.role as Role,
                  district: districtId || undefined,
                  join_code: joinCode || undefined,
                  first_name: values.first_name,
                  last_name: values.last_name,
                  email: values.email,
                  phone: values.phone,
                  password: values.password,
                });
                nav(ROLE_HOME[u.role], { replace: true });
              }}
            />
          )}

          <p className="mt-6 text-center text-[13.5px] text-slate">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-route hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- shared UI */

function StepProgress({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="mt-6 mb-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-slate">
          Step {step + 1} of {total}
          <span className="font-medium text-muted"> · {labels[step]}</span>
        </p>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-route" : "bg-slate-soft"}`}
          />
        ))}
      </div>
    </div>
  );
}

function StepNav({
  onBack,
  nextLabel,
  submitting,
  showBack,
}: {
  onBack?: () => void;
  nextLabel: string;
  submitting?: boolean;
  showBack: boolean;
}) {
  const isFinal = nextLabel.includes("Create") || nextLabel.includes("Join") || nextLabel.includes("…");
  return (
    <div className="mt-1 flex gap-2.5">
      {showBack && (
        <button type="button" onClick={onBack} className="btn-secondary !px-4" disabled={submitting}>
          <ArrowLeft size={15} /> Back
        </button>
      )}
      <button className="btn-primary flex-1 !py-3.5 !text-[15px]" disabled={submitting}>
        {nextLabel}
        {!submitting && !isFinal && <ArrowRight size={15} />}
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {hint && <span className="font-normal normal-case text-muted"> {hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}

function DetailsFields({ register, errors }: { register: any; errors: any }) {
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field id="first_name" label="First name" error={errors.first_name?.message}>
          <input id="first_name" className="input" type="text" autoComplete="given-name" {...register("first_name")} />
        </Field>
        <Field id="last_name" label="Last name" error={errors.last_name?.message}>
          <input id="last_name" className="input" type="text" autoComplete="family-name" {...register("last_name")} />
        </Field>
      </div>
      <Field id="email" label="Work email" error={errors.email?.message}>
        <input
          id="email"
          className="input"
          type="email"
          placeholder="you@district.org"
          autoComplete="username"
          {...register("email")}
        />
      </Field>
      <Field id="phone" label="Phone" hint="(optional)">
        <input id="phone" className="input" type="tel" autoComplete="tel" {...register("phone")} />
      </Field>
    </>
  );
}

function SecurityFields({ register, errors, pw }: { register: any; errors: any; pw: string }) {
  const strength = passwordStrength(pw);
  return (
    <>
      <Field id="password" label="Password" error={errors.password?.message}>
        <input id="password" className="input" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Field id="confirm" label="Confirm password" error={errors.confirm?.message}>
        <input id="confirm" className="input" type="password" autoComplete="new-password" {...register("confirm")} />
      </Field>
      {pw && (
        <div className="flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-soft">
            <div className={`h-full rounded-full transition-all ${strength.cls}`} style={{ width: `${strength.pct}%` }} />
          </div>
          <span
            className={`text-[11.5px] font-semibold ${
              strength.label === "Strong" ? "text-good" : strength.label === "Fair" ? "text-warn" : "text-bad"
            }`}
          >
            {strength.label}
          </span>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- create */

const CREATE_LABELS = ["District", "Your details", "Security"];

function CreateForm({
  onDone,
  onError,
}: {
  onDone: (values: CreateForm) => Promise<unknown>;
  onError: (msg: string | null) => void;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
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
  const pw = form.watch("password");

  async function goNext() {
    onError(null);
    const fields: (keyof CreateForm)[][] = [
      ["district_name"],
      ["first_name", "last_name", "email", "phone"],
      ["password", "confirm"],
    ];
    const ok = await form.trigger(fields[step]);
    if (!ok) return;
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    try {
      await onDone(form.getValues());
    } catch (e) {
      onError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mt-5 flex flex-col gap-[18px]"
      onSubmit={(e) => {
        e.preventDefault();
        void goNext();
      }}
      noValidate
    >
      <StepProgress step={step} total={3} labels={CREATE_LABELS} />

      {step === 0 && (
        <Field id="district_name" label="District or organization" error={form.formState.errors.district_name?.message}>
          <input
            id="district_name"
            className="input"
            type="text"
            placeholder="Riverside Unified School District"
            autoFocus
            {...form.register("district_name")}
          />
        </Field>
      )}

      {step === 1 && <DetailsFields register={form.register} errors={form.formState.errors} />}

      {step === 2 && (
        <>
          <SecurityFields register={form.register} errors={form.formState.errors} pw={pw} />
          <p className="text-[12.5px] leading-snug text-muted">
            You'll be the district administrator. By continuing you agree to the{" "}
            <span className="font-semibold text-route">Terms</span> and{" "}
            <span className="font-semibold text-route">Privacy Policy</span>.
          </p>
        </>
      )}

      <StepNav
        showBack={step > 0}
        onBack={() => {
          onError(null);
          setStep((s) => s - 1);
        }}
        nextLabel={step < 2 ? "Continue" : submitting ? "Creating district…" : "Create district & account"}
        submitting={submitting}
      />
    </form>
  );
}

/* ------------------------------------------------------------- join */

const JOIN_LABELS = ["District", "Role", "Your details", "Security"];

function JoinForm({
  onDone,
  onError,
}: {
  onDone: (values: JoinForm, districtId: string, joinCode: string) => Promise<unknown>;
  onError: (msg: string | null) => void;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
    defaultValues: { role: "", first_name: "", last_name: "", email: "", phone: "", password: "", confirm: "" },
  });
  const pw = form.watch("password");
  const role = form.watch("role");

  const [districts, setDistricts] = useState<PublicDistrict[]>([]);
  const [districtId, setDistrictId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .get("/auth/districts/")
      .then((r) => setDistricts(r.data))
      .catch(() => setDistricts([]));
  }, []);

  const selectedName = useMemo(
    () => districts.find((d) => d.id === districtId)?.name ?? "",
    [districts, districtId],
  );

  async function verifyCode() {
    const code = joinCode.trim();
    if (!code) return;
    try {
      const { data } = await api.post("/auth/lookup-district/", { join_code: code });
      setDistrictId(data.id);
      setCodeStatus({ ok: true, text: `Joining ${data.name}` });
    } catch (e) {
      setCodeStatus({ ok: false, text: errorMessage(e) });
    }
  }

  async function goNext() {
    onError(null);

    if (step === 0) {
      const code = joinCode.trim();
      if (!districtId && !code) {
        onError("Pick your district or enter a join code.");
        return;
      }
      if (code && !codeStatus?.ok) {
        await verifyCode();
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      const ok = await form.trigger("role");
      if (!ok) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      const ok = await form.trigger(["first_name", "last_name", "email", "phone"]);
      if (!ok) return;
      setStep(3);
      return;
    }

    const ok = await form.trigger(["password", "confirm"]);
    if (!ok) return;
    setSubmitting(true);
    try {
      await onDone(form.getValues(), districtId, joinCode.trim());
    } catch (e) {
      onError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mt-5 flex flex-col gap-[18px]"
      onSubmit={(e) => {
        e.preventDefault();
        void goNext();
      }}
      noValidate
    >
      <StepProgress step={step} total={4} labels={JOIN_LABELS} />

      {step === 0 && (
        <>
          <Field id="join_code" label="Join code" hint="(from your district)">
            <div className="flex gap-2">
              <input
                id="join_code"
                className="input font-mono uppercase tracking-[0.15em]"
                type="text"
                placeholder="K7QP2M"
                value={joinCode}
                autoFocus
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setCodeStatus(null);
                }}
                onBlur={verifyCode}
              />
              <button type="button" onClick={verifyCode} className="btn-secondary shrink-0 !px-4">
                Verify
              </button>
            </div>
            {codeStatus && (
              <p className={`mt-1 flex items-center gap-1 text-sm ${codeStatus.ok ? "text-good" : "text-bad"}`}>
                {codeStatus.ok && <Check size={14} />} {codeStatus.text}
              </p>
            )}
          </Field>

          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-line" /> or pick from the list <span className="h-px flex-1 bg-line" />
          </div>

          <Field id="district" label="District">
            <select
              id="district"
              className="select"
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value);
                setJoinCode("");
                setCodeStatus(null);
              }}
            >
              <option value="">Select a district…</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.state}
                </option>
              ))}
            </select>
            {selectedName && !codeStatus && (
              <p className="mt-1 flex items-center gap-1 text-sm text-good">
                <Check size={14} /> Joining {selectedName}
              </p>
            )}
          </Field>
        </>
      )}

      {step === 1 && (
        <Field id="role" label="I'm joining as" error={form.formState.errors.role?.message}>
          <div className="grid gap-2 sm:grid-cols-2">
            {JOIN_ROLES.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => form.setValue("role", r.value, { shouldValidate: true })}
                  className={`rounded-xl p-3 text-left transition-colors ${
                    active
                      ? "border-[1.5px] border-route bg-paper shadow-[0_0_0_4px_rgba(37,99,235,.1)]"
                      : "border border-line bg-paper hover:border-route"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{r.label}</span>
                    {active && (
                      <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-route">
                        <Check size={10} strokeWidth={3} className="text-white" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-slate">{r.body}</p>
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {step === 2 && <DetailsFields register={form.register} errors={form.formState.errors} />}

      {step === 3 && <SecurityFields register={form.register} errors={form.formState.errors} pw={pw} />}

      <StepNav
        showBack={step > 0}
        onBack={() => {
          onError(null);
          setStep((s) => s - 1);
        }}
        nextLabel={step < 3 ? "Continue" : submitting ? "Joining…" : "Join district"}
        submitting={submitting}
      />
    </form>
  );
}
