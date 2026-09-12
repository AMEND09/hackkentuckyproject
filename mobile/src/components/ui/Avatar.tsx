import { Text, View } from "react-native";
import { colors, fonts } from "../../theme";

export function Avatar({
  label,
  size = 42,
  dark,
}: {
  label: string;
  size?: number;
  dark?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: dark ? colors.night : colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: size > 40 ? 16 : 13,
          color: dark ? colors.white : colors.primary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
