import { Pressable, Text, View } from "react-native";
import type { GuardianEta } from "../types";
import { delayLabel, initials, progress, splitClock, stopsAwayLabel } from "../format";
import { colors, fonts, shadow } from "../theme";
import { Avatar } from "./ui/Avatar";

export function RiderCard({ eta, onTrack, onPress }: { eta: GuardianEta; onTrack: () => void; onPress?: () => void }) {
  const clock = splitClock(eta.p50_eta) || splitClock(eta.scheduled_pickup);
  const late = !eta.on_time && (eta.delay_seconds || 0) >= 180;
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        overflow: "hidden",
        ...shadow.card,
      }}
    >
      <View style={{ padding: 17, flexDirection: "row", alignItems: "flex-start", gap: 13 }}>
        <Avatar label={initials(eta.student_first_name)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.ink }}>{eta.student_first_name}</Text>
          <Text style={{ marginTop: 3, fontSize: 13, color: colors.muted }} numberOfLines={1}>
            {[eta.stop_name, eta.route_code].filter(Boolean).join(" · ") || "Not assigned"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.6, color: colors.ink }}>
            {clock?.clock ?? "—"}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 11, fontWeight: "700", color: late ? colors.warn : colors.success }}>
            {delayLabel(eta)}
          </Text>
        </View>
      </View>
      <View style={{ height: 4, backgroundColor: colors.hairline }}>
        <View style={{ width: `${progress(eta) * 100}%`, height: "100%", backgroundColor: late ? colors.warn : colors.primary }} />
      </View>
      <View style={{ paddingHorizontal: 17, paddingVertical: 12, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontSize: 12.5, color: colors.muted }}>{stopsAwayLabel(eta)}</Text>
        <Pressable onPress={onTrack} hitSlop={8} style={{ marginLeft: "auto" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>Track live →</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
