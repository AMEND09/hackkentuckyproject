import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { colors } from "../../theme";

export function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(guardian)/today"))}
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderBottomWidth: 1.6,
          borderLeftWidth: 1.6,
          borderColor: colors.ink,
          transform: [{ rotate: "45deg" }],
          marginLeft: 2,
        }}
      />
    </Pressable>
  );
}
