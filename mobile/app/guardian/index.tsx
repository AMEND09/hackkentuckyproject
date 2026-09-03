import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../src/api/client";

export default function GuardianHome() {
  const qc = useQueryClient();
  const { data: children } = useQuery({ queryKey: ["children"], queryFn: async () => (await api.get("/guardian/children/")).data });
  const { data: etas } = useQuery({
    queryKey: ["etas"],
    queryFn: async () => (await api.get("/guardian/etas/")).data,
    refetchInterval: 5000,
  });
  const { data: notes } = useQuery({ queryKey: ["notes"], queryFn: async () => (await api.get("/notifications/")).data });
  const absent = useMutation({
    mutationFn: (student_id: string) => api.post("/guardian/absent/", { student_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etas"] }),
  });
  const prefs = useMutation({
    mutationFn: () => api.patch("/guardian-links/me/", { notification_preferences: { eta: true, delay: true } }),
  });
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F4F1EA" }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#0B1F3A" }}>Your children</Text>
      <Text style={{ color: "#5C6B7A" }}>Private ETAs only. Other students are never shown.</Text>
      {(etas || []).map((e: { student_id: string; student_first_name: string; stop_name: string; scheduled_pickup: string; delay_seconds: number; on_time: boolean; is_simulated: boolean; status: string }) => (
        <View key={e.student_id} style={{ backgroundColor: "white", padding: 16, borderRadius: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>{e.student_first_name}</Text>
          <Text>Stop: {e.stop_name || "Not assigned"}</Text>
          <Text>Scheduled pickup: {e.scheduled_pickup || "—"}</Text>
          <Text>
            {e.on_time ? "On time" : "Delayed"} · {Math.round((e.delay_seconds || 0) / 60)} min
            {e.is_simulated ? " · simulated location" : ""}
          </Text>
          <Pressable
            onPress={() => absent.mutate(e.student_id)}
            style={{ marginTop: 10, backgroundColor: "#0B1F3A", padding: 12, borderRadius: 8, minHeight: 48 }}
          >
            <Text style={{ color: "white", textAlign: "center" }}>Mark {e.student_first_name} absent</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => prefs.mutate()} style={{ padding: 12 }}>
        <Text style={{ textDecorationLine: "underline" }}>Keep delay notifications on</Text>
      </Pressable>
      <Text style={{ fontWeight: "700" }}>Notifications</Text>
      {(notes?.results || []).slice(0, 8).map((n: { id: string; title: string; body: string }) => (
        <View key={n.id}>
          <Text style={{ fontWeight: "600" }}>{n.title}</Text>
          <Text>{n.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
