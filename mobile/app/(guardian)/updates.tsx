import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useMarkAllRead, useNotifications } from "../../src/api/hooks";
import { NotificationRow } from "../../src/components/NotificationRow";
import { ScreenHeader } from "../../src/components/ui/ScreenHeader";
import { isToday } from "../../src/format";
import { colors } from "../../src/theme";

export default function Updates() {
  const router = useRouter();
  const { data } = useNotifications();
  const mark = useMarkAllRead();
  const notes = data || [];
  const today = notes.filter((n) => isToday(n.created_at));
  const earlier = notes.filter((n) => !isToday(n.created_at));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        back
        title="Updates"
        right={
          <Pressable onPress={() => mark.mutate()}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>Mark all read</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 36 }}>
        <Section title="Today" empty={today.length === 0 && notes.length > 0 ? undefined : today.length === 0 ? "No updates yet today." : undefined}>
          {today.map((n) => (
            <NotificationRow key={n.id} item={n} onTrack={() => router.push("/(guardian)/track")} />
          ))}
        </Section>
        {earlier.length ? (
          <Section title="Earlier">
            {earlier.map((n) => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </Section>
        ) : null}
        <Text style={{ marginTop: 20, fontSize: 11.5, lineHeight: 18, color: colors.faint }}>
          You receive updates only for routes your own riders are on. Demo data.
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children, empty }: { title: string; children: ReactNode; empty?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.faint }}>
        {title}
      </Text>
      <View style={{ marginTop: 12, gap: 10 }}>{children}</View>
      {empty ? <Text style={{ marginTop: 8, color: colors.muted, fontSize: 13 }}>{empty}</Text> : null}
    </View>
  );
}
