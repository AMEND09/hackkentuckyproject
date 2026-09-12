import { Text, View } from "react-native";
import { formatClock, splitClock } from "../../format";
import { colors, fonts } from "../../theme";

export function EtaClock({
  eta,
  stop,
  scheduled,
}: {
  eta?: string | null;
  stop?: string | null;
  scheduled?: string | null;
}) {
  const clock = splitClock(eta) || splitClock(scheduled);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 11 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 52, letterSpacing: -2, lineHeight: 52, color: colors.ink }}>
          {clock?.clock ?? "—"}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted, paddingBottom: 7 }}>
          {clock?.period ?? ""}
        </Text>
      </View>
      <Text style={{ marginTop: 10, fontSize: 14.5, lineHeight: 22, color: colors.muted }}>
        {stop ? `Arriving at ${stop}.` : "Waiting for a live estimate."}
        {scheduled ? ` Scheduled pickup was ${formatClock(scheduled)}.` : ""}
      </Text>
    </View>
  );
}
