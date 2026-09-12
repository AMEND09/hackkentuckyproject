import { Text, View } from "react-native";
import type { GuardianEta } from "../../types";
import { delayLabel, progress as routeProgress, splitClock } from "../../format";
import { minutesUntil, rideStatusLine } from "../../live/rideActivity";
import { colors, fonts } from "../../theme";

export function RideLiveCard({ eta }: { eta: GuardianEta }) {
  const clock = splitClock(eta.p50_eta) || splitClock(eta.scheduled_pickup);
  const late = !eta.on_time && (eta.delay_seconds || 0) >= 180;
  const t = routeProgress(eta);
  const minutes = minutesUntil(eta.p50_eta) || Math.max(2, Math.round((eta.stop_count || 4) * 2.4));
  const status = rideStatusLine(eta);
  const accent = late ? colors.warn : colors.primary;

  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5, color: colors.primary }}>DART</Text>
        <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "600", color: colors.muted }}>
          {eta.route_code || "Bus"}
        </Text>
        <View
          style={{
            marginLeft: "auto",
            backgroundColor: "rgba(220,38,38,.08)",
            borderRadius: 99,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 0.7, color: colors.danger }}>LIVE</Text>
        </View>
      </View>

      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.ink }}>{eta.student_first_name}</Text>
          <Text style={{ marginTop: 3, fontSize: 13.5, fontWeight: "600", color: late ? colors.warn : colors.success }}>
            {status}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 36, letterSpacing: -1.2, color: colors.ink, lineHeight: 36 }}>
              {minutes}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>min</Text>
          </View>
          <Text style={{ marginTop: 2, fontSize: 12, color: colors.muted }}>
            {clock ? `${clock.clock} ${clock.period}` : "Updating"}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 14, height: 22, justifyContent: "center" }}>
        <View style={{ height: 5, borderRadius: 99, backgroundColor: colors.hairline, overflow: "hidden" }}>
          <View style={{ width: `${Math.max(8, t * 100)}%`, height: "100%", backgroundColor: accent, borderRadius: 99 }} />
        </View>
        <View
          style={{
            position: "absolute",
            left: `${Math.min(92, Math.max(0, t * 100))}%`,
            marginLeft: -11,
            width: 22,
            height: 22,
            borderRadius: 99,
            backgroundColor: colors.white,
            borderWidth: 2,
            borderColor: accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: accent }} />
        </View>
      </View>

      <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, fontSize: 12.5, color: colors.muted }} numberOfLines={1}>
          {eta.stop_name || "Your stop"}
        </Text>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: late ? colors.warn : colors.success }}>
          {delayLabel(eta)}
        </Text>
      </View>
    </View>
  );
}
