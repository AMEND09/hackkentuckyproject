import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View, FlatList } from "react-native";
import { api } from "../../src/api/client";

export default function DriverHome() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["driver-trips"],
    queryFn: async () => (await api.get("/trips/")).data,
    refetchInterval: 8000,
  });
  const rows = data?.results || [];
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#F4F1EA" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#0B1F3A" }}>Today's trips</Text>
      <Text style={{ color: "#5C6B7A", marginBottom: 12 }}>Assigned routes only. Not certified navigation.</Text>
      {isLoading && <Text>Loading…</Text>}
      {error && <Text style={{ color: "#B42318" }}>Could not load trips.</Text>}
      <FlatList
        data={rows}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={({ item }: { item: { id: string; route_code: string; status: string; current_delay_seconds: number } }) => (
          <Link href={`/driver/${item.id}`} asChild>
            <Pressable style={{ backgroundColor: "white", padding: 16, borderRadius: 10, marginBottom: 10, minHeight: 64 }}>
              <Text style={{ fontWeight: "700" }}>{item.route_code}</Text>
              <Text>
                {item.status} · delay {Math.round(item.current_delay_seconds / 60)} min
              </Text>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={<Text>No assigned trips. Publish a plan from the web app.</Text>}
      />
    </View>
  );
}
