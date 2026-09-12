import type { CSSProperties } from "react";

/**
 * DART wordmark wipe — left-to-right reveal with a blue leading edge.
 * Ported from the wordmark-wipe design artifact.
 */
export function WordmarkWipe({
  size = "md",
  loop = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  /** When false, plays once then holds fully revealed. */
  loop?: boolean;
  className?: string;
}) {
  const dims =
    size === "lg"
      ? { w: 320, h: 96 }
      : size === "sm"
        ? { w: 180, h: 54 }
        : { w: 260, h: 78 };

  return (
    <div
      className={`relative ${className}`}
      style={{ width: dims.w, height: dims.h, ["--wipe-travel" as string]: `${dims.w}px` } as CSSProperties}
      aria-hidden
    >
      <img
        src="/brand/dart-logo.png"
        alt=""
        className={`dart-wordmark-logo block ${loop ? "dart-wipe-loop" : "dart-wipe-once"}`}
        style={{ width: dims.w, height: dims.h, objectFit: "contain" }}
        draggable={false}
      />
      <div className={`dart-wordmark-edge ${loop ? "dart-edge-loop" : "dart-edge-once"}`} />
    </div>
  );
}

/**
 * Blue launch lockup — mark + tagline rising in.
 * Ported from the launch-lockup design artifact.
 */
export function LaunchLockup({
  loop = false,
  className = "",
}: {
  loop?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-[18px] ${className}`}>
      <img
        src="/brand/dart-logo.png"
        alt="DART"
        className={`block h-[76px] w-[252px] object-contain brightness-0 invert ${
          loop ? "dart-lockup-lift-loop" : "dart-lockup-lift-once"
        }`}
        draggable={false}
      />
      <div
        className={`whitespace-nowrap text-xs font-semibold uppercase text-white/80 ${
          loop ? "dart-lockup-tag-loop" : "dart-lockup-tag-once"
        }`}
      >
        District Automated Routing &amp; Tracking
      </div>
    </div>
  );
}
