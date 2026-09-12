import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View, FlatList } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthProvider";
import { useDistrictLive } from "../../src/live/DistrictLiveProvider";
import { ScreenHeader } from "../../src/components/ui/ScreenHeader";
import { colors, fonts, shadow } from "../../src/theme";

type TripRow = {
  id: string;
  route_code: string;
  school_name?: string;
  status: string;
  current_delay_seconds: number;
  is_simulated?: boolean;
};

export default function DriverHome() {
  const { user, signOut } = useAuth();
  const { positions, connected } = useDistrictLive();
  const { data, isLoading, error } = useQuery({
    queryKey: ["driver-trips"],
    queryFn: async () => (await api.get("/trips/")).data,
    refetchInterval: 8000,
  });
  const rows: TripRow[] = data?.results || [];
  const liveCount = rows.filter((t) => positions[t.id]).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Today's runs"
        subtitle={user?.district_name || "Assigned routes only"}
        right={
          <Pressable onPress={() => void signOut()} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>Sign out</Text>
          </Pressable>
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 22, paddingBottom: 36, gap: 12 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8, gap: 10 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.5, color: colors.ink }}>
              {liveCount ? `${liveCount} live` : connected ? "Waiting for dispatch" : "Your routes"}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.muted }}>
              {liveCount
                ? "The district live demo is moving these buses. Open a run to follow it."
                : "Assigned trips only. Not certified navigation. When an admin starts the live demo, the bus moves here automatically."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const live = positions[item.id];
          const late = (item.current_delay_seconds || 0) >= 180;
          return (
            <Link href={`/driver/${item.id}`} asChild>
              <Pressable
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 16,
                  minHeight: 72,
                  ...shadow.card,
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 0.4, color: colors.primary }}>
                  {item.school_name || "Route"}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 18, fontWeight: "700", color: colors.ink }}>{item.route_code}</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: colors.muted }}>
                  {live ? "Live now" : item.status.replace("_", " ")}
                  {live || item.is_simulated ? " · simulated GPS" : ""}
                  {late ? ` · +${Math.round(item.current_delay_seconds / 60)} min` : ""}
                </Text>
              </Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: colors.muted }}>Loading…</Text>
          ) : error ? (
            <Text style={{ color: colors.danger }}>Could not load trips.</Text>
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 18,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>No assigned trips</Text>
              <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.muted }}>
                A planner needs to publish a plan that includes your driver profile. After that, dispatch starts the live
                demo and your run appears here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
