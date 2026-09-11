// Transparent DART dart mark, rendered directly on any surface (no plate).

const MARK_RATIO = 162 / 184; // intrinsic width / height

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
              Automated Routing &amp; Tracking
            </span>
          )}
        </span>
      )}
    </span>
  );
}
