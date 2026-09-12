// Transparent DART dart mark, rendered directly on any surface (no plate).

const MARK_RATIO = 751 / 756; // intrinsic width / height
/** Full lockup: D + stylized A + R T as a single PNG (used in the web navbar). */
const LOGO_RATIO = 1377 / 416;

export function LogoMark({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/dart-mark.png"
      alt="DART"
      height={size}
      width={Math.round(size * MARK_RATIO)}
      style={{ height: size, width: Math.round(size * MARK_RATIO) }}
      className={`select-none shrink-0 ${className}`}
      draggable={false}
    />
  );
}

/** Combined wordmark image — matches the marketing navbar lockup. */
export function LogoWordmark({
  size = 26,
  tone = "ink",
  className = "",
}: {
  size?: number;
  tone?: "ink" | "white";
  className?: string;
}) {
  return (
    <img
      src="/brand/dart-logo.png"
      alt="DART"
      height={size}
      width={Math.round(size * LOGO_RATIO)}
      style={{
        height: size,
        width: "auto",
        filter: tone === "white" ? "invert(1) hue-rotate(180deg) saturate(1.6)" : undefined,
      }}
      className={`block select-none shrink-0 ${className}`}
      draggable={false}
    />
  );
}

export function Logo({
  size = 30,
  showWordmark = true,
  showTagline = false,
  tone = "ink",
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  tone?: "ink" | "white";
  className?: string;
}) {
  const wordColor = tone === "white" ? "text-white" : "text-ink";
  const tagColor = tone === "white" ? "text-white/55" : "text-slate";

  // Sidebar / compact: mark + text tagline. Landing / marketing: full PNG lockup.
  if (showWordmark && !showTagline) {
    return <LogoWordmark size={size} tone={tone} className={className} />;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className={`font-display font-bold tracking-tight ${wordColor}`} style={{ fontSize: size * 0.7 }}>
            DART
          </span>
          {showTagline && (
            <span className={`mt-1 text-[10px] font-medium uppercase tracking-[0.12em] ${tagColor}`}>
              Routing &amp; Tracking
            </span>
          )}
        </span>
      )}
    </span>
  );
}
