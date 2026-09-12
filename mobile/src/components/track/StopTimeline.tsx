import { Text, View } from "react-native";
import type { RouteStop } from "../../types";
import { formatClock } from "../../format";
import { colors } from "../../theme";

export function StopTimeline({
  stops,
  current,
  mine,
  rider,
}: {
  stops: RouteStop[];
  current: number;
  mine?: number | null;
  rider?: string;
}) {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const visible = pickStops(ordered, current, mine);
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 18,
      }}
    >
      <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.faint }}>
        Remaining stops
      </Text>
      <View style={{ marginTop: 16 }}>
        {visible.map((stop, i) => {
          const last = i === visible.length - 1;
          const done = stop.sequence < current;
          const live = stop.sequence === current || (current === 0 && i === 0 && !done);
          const mineStop = mine != null && stop.sequence === mine;
          return (
            <View key={stop.id} style={{ flexDirection: "row", gap: 13 }}>
              <View style={{ width: 14, alignItems: "center" }}>
                <Dot done={done} live={live && !done} />
                {!last ? <View style={{ width: 1.5, flex: 1, minHeight: 30, backgroundColor: colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
                <Text style={{ fontSize: live || mineStop ? 15 : 14, fontWeight: "600", color: done ? colors.muted : colors.ink }}>
                  {stop.kind === "school" ? stop.name : `Stop ${stop.sequence} · ${stop.name}`}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12.5,
                    fontWeight: mineStop ? "600" : "400",
                    color: mineStop && !done ? colors.warn : colors.faint,
                  }}
                >
                  {done
                    ? `Completed ${formatClock(stop.scheduled_arrival)}`
                    : mineStop
                      ? `${rider ? `${rider}'s stop` : "Your stop"} · est. ${formatClock(stop.scheduled_arrival)}`
                      : `Est. arrival ${formatClock(stop.scheduled_arrival)}`}
                </Text>
              </View>
            </View>
          );
        })}
        {!visible.length ? <Text style={{ color: colors.muted, fontSize: 13 }}>Route stops will appear once a trip is published.</Text> : null}
      </View>
    </View>
  );
}

function Dot({ done, live }: { done: boolean; live: boolean }) {
  if (live) {
    return (
      <View style={{ width: 13, height: 13, borderRadius: 99, backgroundColor: colors.warn, marginTop: 2 }} />
    );
  }
  if (done) {
    return <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: "#CBD5E1", marginTop: 3 }} />;
  }
  return (
    <View
      style={{
        width: 9,
        height: 9,
        borderRadius: 99,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        marginTop: 3,
      }}
    />
  );
}

function pickStops(stops: RouteStop[], current: number, mine?: number | null) {
  if (stops.length <= 4) return stops;
  const school = stops.find((s) => s.kind === "school") || stops[stops.length - 1];
  const mineStop = mine != null ? stops.find((s) => s.sequence === mine) : undefined;
  const live = stops.find((s) => s.sequence === current) || stops[0];
  const prev = stops.filter((s) => s.sequence < (live?.sequence ?? 0)).slice(-1)[0];
  const uniq = new Map<string, RouteStop>();
  for (const s of [prev, live, mineStop, school]) {
    if (s) uniq.set(s.id, s);
  }
  return [...uniq.values()].sort((a, b) => a.sequence - b.sequence);
}
