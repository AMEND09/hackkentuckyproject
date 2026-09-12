import { Logo, LogoMark } from "./Logo";

/**
 * Dark brand panel shown beside the sign-in / create-account forms.
 * Mirrors the DART auth-screen design: a faint route graphic, the wordmark,
 * the dart mark, a heading, and a short supporting line.
 */
export function AuthBrandPanel({ heading, sub }: { heading: string; sub: string }) {
  return (
    <section className="relative hidden min-h-0 overflow-hidden bg-navy p-[clamp(32px,4vw,64px)] text-white lg:flex lg:h-full lg:flex-col lg:justify-between lg:gap-12">
      <svg
        viewBox="0 0 500 660"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <g stroke="rgba(255,255,255,.07)" strokeWidth="1.4">
          <path d="M0 120H500M0 260H500M0 400H500M0 540H500M110 0V660M240 0V660M380 0V660" />
        </g>
        <path
          d="M-20 540 L110 540 L110 400 L240 400 L240 260 L380 260 L380 120 L520 120"
          fill="none"
          stroke="rgba(37,99,235,.85)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g fill="#0B1120" stroke="rgba(96,165,250,.9)" strokeWidth="2.4">
          <circle cx="110" cy="540" r="5.5" />
          <circle cx="110" cy="400" r="5.5" />
          <circle cx="240" cy="400" r="5.5" />
          <circle cx="240" cy="260" r="5.5" />
          <circle cx="380" cy="260" r="5.5" />
        </g>
      </svg>

      <div className="relative">
        <Logo size={26} tone="white" />
      </div>

      <div className="relative">
        <LogoMark size={52} />
        <h2 className="mt-7 max-w-[18em] font-display text-[clamp(28px,2.8vw,38px)] font-bold leading-tight tracking-tight">
          {heading}
        </h2>
        <p className="mt-4 max-w-[26em] text-base leading-relaxed text-white/60">{sub}</p>
      </div>

      <p className="relative text-xs text-white/40">Product demo · Fictional operational data</p>
    </section>
  );
}
