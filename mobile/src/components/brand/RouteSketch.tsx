import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { DartA } from "./DartA";

const WAYPOINTS = [
  { x: 0.2, y: 0.88 },
  { x: 0.2, y: 0.48 },
  { x: 0.58, y: 0.48 },
  { x: 0.58, y: 0.16 },
  { x: 0.86, y: 0.16 },
];

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function samplePath(t: number, w: number, h: number) {
  const pts = WAYPOINTS.map((p) => ({ x: p.x * w, y: p.y * h }));
  const segs = pts.slice(1).map((p, i) => {
    const a = pts[i];
    return { a, b: p, dx: p.x - a.x, dy: p.y - a.y, len: Math.hypot(p.x - a.x, p.y - a.y) };
  });
  const total = segs.reduce((s, g) => s + g.len, 0) || 1;
  let dist = Math.min(1, Math.max(0, t)) * total;
  for (const g of segs) {
    if (dist <= g.len) {
      const u = g.len ? dist / g.len : 1;
      return {
        x: g.a.x + g.dx * u,
        y: g.a.y + g.dy * u,
        angle: (Math.atan2(g.dy, g.dx) * 180) / Math.PI + 90,
      };
    }
    dist -= g.len;
  }
  const last = segs[segs.length - 1];
  return { x: last.b.x, y: last.b.y, angle: (Math.atan2(last.dy, last.dx) * 180) / Math.PI + 90 };
}

/** Schematic route. A dart follows the line once, then rests at the school. */
export function RouteSketch() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [bus, setBus] = useState({ x: 0, y: 0, angle: 0, arrived: false });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!box.w) return;
    const DURATION = 5200;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start == null) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      const pos = samplePath(easeInOut(t), box.w, box.h);
      setBus({ ...pos, arrived: t >= 1 });
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    setBus({ ...samplePath(0, box.w, box.h), arrived: false });
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [box]);

  return (
    <View style={{ flex: 1, minHeight: 220 }} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      <Grid />
      <View style={{ position: "absolute", left: "20%", top: "48%", bottom: "12%", width: 3, backgroundColor: colors.primary, borderRadius: 2 }} />
      <DashedH left="20%" top="48%" width="38%" />
      <View style={{ position: "absolute", left: "58%", top: "16%", width: 3, height: "32%", backgroundColor: colors.primary, borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "58%", top: "16%", width: "28%", height: 3, backgroundColor: colors.primary, borderRadius: 2 }} />

      <View style={{ position: "absolute", left: "36%", top: "28%", width: 28, height: 28, borderRadius: 99, backgroundColor: "#DBEAFE" }} />
      <View
        style={{
          position: "absolute",
          left: "20%",
          top: "48%",
          width: 16,
          height: 16,
          marginLeft: -6.5,
          marginTop: -6.5,
          borderRadius: 99,
          backgroundColor: colors.white,
          borderWidth: 3,
          borderColor: colors.primary,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: "86%",
          top: "16%",
          width: 12,
          height: 12,
          marginLeft: -4.5,
          marginTop: -4.5,
          borderRadius: 2,
          backgroundColor: colors.white,
          borderWidth: 2,
          borderColor: colors.ink,
        }}
      />

      {box.w > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: bus.x - 14,
            top: bus.y - 16,
            width: 28,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: bus.arrived ? 36 : 26,
              height: bus.arrived ? 36 : 26,
              borderRadius: 99,
              backgroundColor: "rgba(37,99,235,.16)",
            }}
          />
          <View style={{ transform: [{ rotate: `${bus.angle}deg` }] }}>
            <DartA size={22} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DashedH({ left, top, width }: { left: `${number}%`; top: `${number}%`; width: `${number}%` }) {
  return (
    <View style={{ position: "absolute", left, top, width, height: 3, flexDirection: "row", overflow: "hidden", gap: 6 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: colors.primary }} />
      ))}
    </View>
  );
}

function Grid() {
  const v = [16, 33, 50, 67, 84];
  const h = [14, 30, 46, 62, 78];
  return (
    <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
      {v.map((x) => (
        <View key={`v${x}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 1, backgroundColor: "#EEF2F7" }} />
      ))}
      {h.map((y) => (
        <View key={`h${y}`} style={{ position: "absolute", left: 0, right: 0, top: `${y}%`, height: 1, backgroundColor: "#EEF2F7" }} />
      ))}
    </View>
  );
}
