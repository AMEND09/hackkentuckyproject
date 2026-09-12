import { Image, Text, View } from "react-native";
import { colors, fonts } from "../../theme";

const mark = require("../../../assets/brand/dart-mark.png");
const wordmark = require("../../../assets/brand/dart-logo.png");

type Props = {
  size?: number;
  wordmark?: boolean;
  tint?: "light" | "dark";
};

export function DartMark({ size = 44 }: { size?: number }) {
  return <Image source={mark} style={{ width: size, height: size }} resizeMode="contain" />;
}

export function DartLogo({ size = 22, wordmark: showWord = false, tint = "dark" }: Props) {
  const color = tint === "light" ? colors.white : colors.ink;
  if (showWord) {
    return <Image source={wordmark} style={{ height: size + 6, width: size * 5 }} resizeMode="contain" />;
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
      <Image source={mark} style={{ width: size, height: size }} resizeMode="contain" />
      <Text style={{ fontFamily: fonts.heading, fontSize: 15, letterSpacing: -0.2, color }}>DART</Text>
    </View>
  );
}
