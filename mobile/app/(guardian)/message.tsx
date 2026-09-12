import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenHeader } from "../../src/components/ui/ScreenHeader";
import { colors } from "../../src/theme";

type Bubble = { id: string; from: "me" | "office"; text: string; time: string };

const seed: Bubble[] = [
  {
    id: "1",
    from: "me",
    text: "The bus is showing a few minutes late — will the school hold the first bell for bus riders?",
    time: "just now",
  },
];

export default function MessageOffice() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Bubble[]>(seed);

  function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const mine: Bubble = { id: String(Date.now()), from: "me", text: body, time: "now" };
    setRows((r) => [...r, mine]);
    setTimeout(() => {
      setRows((r) => [
        ...r,
        {
          id: String(Date.now() + 1),
          from: "office",
          text: "Thanks — we have your note. This is a demo reply from the transportation office. In production this thread would go to dispatch.",
          time: "now",
        },
      ]);
    }, 900);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader back title="Transportation office" subtitle="Replies weekdays, 6 AM – 4 PM" />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 20, gap: 14 }}>
        <Text style={{ textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.faint }}>Demo thread · not a live inbox</Text>
        {rows.map((b) => (
          <View
            key={b.id}
            style={{
              alignSelf: b.from === "me" ? "flex-end" : "flex-start",
              maxWidth: "82%",
              backgroundColor: b.from === "me" ? colors.primary : colors.surface,
              borderWidth: b.from === "me" ? 0 : 1,
              borderColor: colors.border,
              borderRadius: b.from === "me" ? 14 : 14,
              borderBottomRightRadius: b.from === "me" ? 4 : 14,
              borderBottomLeftRadius: b.from === "office" ? 4 : 14,
              paddingHorizontal: 15,
              paddingVertical: 13,
            }}
          >
            <Text style={{ fontSize: 14, lineHeight: 21, color: b.from === "me" ? colors.white : colors.ink }}>{b.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          padding: 14,
          paddingBottom: 20,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the office"
          placeholderTextColor={colors.faint}
          style={{
            flex: 1,
            minHeight: 46,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.field,
            borderRadius: 12,
            paddingHorizontal: 14,
            fontSize: 15,
            color: colors.ink,
          }}
        />
        <Pressable
          onPress={send}
          style={{
            minWidth: 72,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 14,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: "600" }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
