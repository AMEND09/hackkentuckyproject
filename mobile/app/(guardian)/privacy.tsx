import { ScrollView, Text, View } from "react-native";
import { ScreenHeader } from "../../src/components/ui/ScreenHeader";
import { colors, fonts } from "../../src/theme";

export default function Privacy() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader back title="Privacy" />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 36 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.ink }}>
          You only see your riders
        </Text>
        <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 24, color: colors.muted }}>
          DART never shows another family's students, a driver manifest, or a full passenger list. Arrival estimates and
          live map positions are scoped to the riders linked to this account.
        </Text>
        <Text style={{ marginTop: 16, fontSize: 15, lineHeight: 24, color: colors.muted }}>
          Bus locations in this product demo are simulated. They are labeled on the Track screen and are not certified
          navigation or a substitute for being at the stop on time.
        </Text>
        <Text style={{ marginTop: 16, fontSize: 15, lineHeight: 24, color: colors.muted }}>
          Marking a rider absent tells dispatch and the driver. The stop stays on the route for other students.
        </Text>
      </ScrollView>
    </View>
  );
}
