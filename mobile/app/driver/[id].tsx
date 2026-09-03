import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { api } from "../../src/api/client";

export default function DriverTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: trip } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => (await api.get(`/trips/${id}/`)).data,
    refetchInterval: 4000,
  });
  const { data: manifest } = useQuery({
    queryKey: ["manifest", id],
    queryFn: async () => (await api.get(`/trips/${id}/manifest/`)).data,
  });
  const act = (path: string, body: object = {}) =>
    api.post(`/trips/${id}/${path}`, body).then(() => qc.invalidateQueries({ queryKey: ["trip", id] }));

  const [sim, setSim] = useState(false);
  const tRef = useRef(0);
  const simStep = async (t: number) => {
    tRef.current = t;
    await api.post(`/trips/${id}/simulate-step/`, { t });
    qc.invalidateQueries({ queryKey: ["trip", id] });
  };
  const startDrive = async () => {
    try {
      await act("start/");
    } catch {
      // Trip may already be active — still run the demo simulation.
    }
    await simStep(0.01);
    setSim(true);
  };
  useEffect(() => {
    if (!sim) return;
    const handle = setInterval(async () => {
      const next = Math.min(0.98, tRef.current + 0.04);
      if (next >= 0.98) {
        setSim(false);
        return;
      }
      await simStep(next);
    }, 2200);
    return () => clearInterval(handle);
  }, [sim, id, qc]);

  const [incident, setIncident] = useState("");
  const report = useMutation({
    mutationFn: () => api.post("/incidents/", { trip: id, type: "other", severity: "medium", description: incident || "Driver report" }),
  });

  const stops = trip?.stops || [];
  const pos = trip?.last_position;
  const g = trip?.guidance;
  const coords = useMemo(() => {
    const path = trip?.path || [];
    if (path.length > 1) {
      return path.map((c: [number, number]) => ({ longitude: c[0], latitude: c[1] }));
    }
    return stops.map((s: { latitude: string; longitude: string }) => ({
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
    }));
  }, [trip?.path, stops]);
  const bus = pos
    ? { latitude: Number(pos.latitude), longitude: Number(pos.longitude) }
    : coords[0];

  if (!trip) return <Text>Loading…</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F4F1EA" }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#0B1F3A", padding: 16, borderRadius: 12 }}>
        <Text style={{ color: "#9DB7D8", fontSize: 12 }}>{trip.route_code}</Text>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "700" }}>{g?.instruction || "Follow planned stops"}</Text>
        <Text style={{ color: "white", marginTop: 6 }}>
          {g?.then ? `Then ${g.then}` : ""}
        </Text>
        <Text style={{ color: "white" }}>
          {g?.follows_streets ? "Following streets" : "Straight-line fallback"}
          {trip.is_simulated ? " · Simulated GPS" : ""}
        </Text>
      </View>
      {Platform.OS !== "web" && bus ? (
        <MapView
          style={{ height: 280, borderRadius: 12 }}
          region={{
            latitude: bus.latitude,
            longitude: bus.longitude,
            latitudeDelta: 0.045,
            longitudeDelta: 0.045,
          }}
        >
          {coords.length > 1 ? <Polyline coordinates={coords} strokeColor="#4285F4" strokeWidth={5} /> : null}
          {stops.map((s: { id: string; name: string; latitude: string; longitude: string }) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: Number(s.latitude), longitude: Number(s.longitude) }}
              title={s.name}
            />
          ))}
          <Marker coordinate={bus} title="Bus" pinColor="#B42318" />
        </MapView>
      ) : (
        <Text style={{ fontSize: 12, color: "#5C6B7A" }}>
          Map follows the stop polyline on a phone or tablet. On web, use the RouteWise site Route guide.
        </Text>
      )}
      <Text>
        {trip.status} · delay {Math.round(trip.current_delay_seconds / 60)} min
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Btn label={sim ? "Driving…" : "Start trip"} onPress={() => startDrive()} />
        <Btn label="Pause" onPress={() => act("pause/")} />
        <Btn label="Resume" onPress={() => act("resume/")} />
        <Btn label="Complete" onPress={() => act("complete/")} />
      </View>
      {(manifest || []).map((stop: { stop_id: string; stop_name: string; students: { id: string; first_name: string; last_name: string; wheelchair: boolean }[] }) => (
        <View key={stop.stop_id} style={{ backgroundColor: "white", padding: 12, borderRadius: 10 }}>
          <Text style={{ fontWeight: "700" }}>{stop.stop_name}</Text>
          {stop.students.map((s) => (
            <Text key={s.id}>
              {s.first_name} {s.last_name}
              {s.wheelchair ? " · wheelchair" : ""}
            </Text>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Btn label="Arrive" onPress={() => act("arrive-stop/", { route_stop_id: stop.stop_id })} />
            <Btn
              label="All boarded"
              onPress={() =>
                act("depart-stop/", { route_stop_id: stop.stop_id, boarded_count: stop.students.length, absent_count: 0 })
              }
            />
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => setSim((v) => !v)}
        style={{ backgroundColor: "#C47B16", padding: 14, borderRadius: 8, minHeight: 48, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>{sim ? "Stop following" : "Follow route (demo)"}</Text>
      </Pressable>
      <Text style={{ fontSize: 12, color: "#5C6B7A" }}>
        Follow route interpolates stop coordinates and posts GPS. It is labeled simulated and is not certified navigation.
      </Text>
      <TextInput
        placeholder="Incident notes"
        value={incident}
        onChangeText={setIncident}
        style={{ backgroundColor: "white", padding: 12, borderRadius: 8, minHeight: 48 }}
      />
      <Btn label="Report incident" onPress={() => report.mutate()} />
    </ScrollView>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: "#0B1F3A", padding: 12, borderRadius: 8, minHeight: 44 }}>
      <Text style={{ color: "white", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
