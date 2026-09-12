import { Text, View } from "react-native";
import { colors, fonts } from "../../theme";

/** Geometric DART A that stays visible at small sizes (PNG mark has too much padding). */
export function DartA({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  const stem = Math.max(2, size * 0.1);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "flex-end" }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.48,
          borderRightWidth: size * 0.48,
          borderBottomWidth: size,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: size * 0.18,
          width: size * 0.38,
          height: stem,
          backgroundColor: colors.white,
        }}
      />
    </View>
  );
}

export function DartLockup({ size = 22 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <DartA size={size} />
      <Text style={{ fontFamily: fonts.heading, fontSize: 17, letterSpacing: -0.3, color: colors.ink }}>DART</Text>
    </View>
  );
}
