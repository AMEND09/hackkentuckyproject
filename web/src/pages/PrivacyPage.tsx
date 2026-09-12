import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="DART home">
          <Logo />
        </Link>
        <Link to="/login" className="text-sm font-semibold text-primary">
          Sign in
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Legal</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm text-muted">Last updated September 12, 2026</p>
        <div className="mt-8 space-y-5 text-[15px] leading-7 text-slate-600">
          <p>
            DART (District Automated Routing &amp; Tracking) is a product demonstration. Demo accounts use fictional
            students, routes, and bus positions. They are not a certified student-transportation or navigation system.
          </p>
          <p>
            If you create an account we store the name, email, and password you provide, plus the district and rider
            links you choose. Guardians only see riders linked to their account. Driver location is collected only while
            a driver is signed in and sharing a live trip.
          </p>
          <p>
            Arrival notices and lock-screen alerts are sent only for riders you have linked, and only if you allow
            notifications. We do not sell personal information. Hosted demo data lives on our Railway project for this
            proof of concept.
          </p>
          <p>
            Questions: use the email on this App Store listing, or sign in and contact your district administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
