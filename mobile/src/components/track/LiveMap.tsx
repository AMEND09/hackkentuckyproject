import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme";
import { SimulatedBadge } from "./SimulatedBadge";

const darkStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b1120" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b9bb4" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1120" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

type Coord = { latitude: number; longitude: number };

function asCoord(c?: { latitude?: unknown; longitude?: unknown } | null): Coord | null {
  if (!c) return null;
  const latitude = Number(c.latitude);
  const longitude = Number(c.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  return { latitude, longitude };
}

const LOUISVILLE = { latitude: 38.2527, longitude: -85.7585 };

export function LiveMap({
  bus,
  heading,
  path,
  stops,
  myStopId,
  title,
}: {
  bus?: Coord | null;
  heading?: number | null;
  path: Coord[];
  stops: { id: string; name: string; latitude: number; longitude: number }[];
  myStopId?: string;
  title?: string;
}) {
  const [full, setFull] = useState(false);
  const safeBus = asCoord(bus);
  const safePath = path.map(asCoord).filter((c): c is Coord => !!c);
  const safeStops = stops.flatMap((s) => {
    const c = asCoord(s);
    return c ? [{ ...s, ...c }] : [];
  });
  const center = safeBus || safePath[0] || safeStops[0] || LOUISVILLE;

  return (
    <>
      <MapCanvas
        center={center}
        bus={safeBus}
        heading={heading}
        path={safePath}
        stops={safeStops}
        myStopId={myStopId}
        height={280}
        delta={0.04}
        onToggle={() => setFull(true)}
        expanded={false}
      />
      <Modal visible={full} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setFull(false)}>
        <MapCanvas
          center={center}
          bus={safeBus}
          heading={heading}
          path={safePath}
          stops={safeStops}
          myStopId={myStopId}
          fill
          delta={0.012}
          follow
          title={title}
          onToggle={() => setFull(false)}
          expanded
        />
      </Modal>
    </>
  );
}

function MapCanvas({
  center,
  bus,
  heading,
  path,
  stops,
  myStopId,
  height,
  fill,
  delta,
  follow,
  title,
  onToggle,
  expanded,
}: {
  center: Coord;
  bus?: Coord | null;
  heading?: number | null;
  path: Coord[];
  stops: { id: string; name: string; latitude: number; longitude: number }[];
  myStopId?: string;
  height?: number;
  fill?: boolean;
  delta: number;
  follow?: boolean;
  title?: string;
  onToggle: () => void;
  expanded: boolean;
}) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!follow || !asCoord(bus)) return;
    mapRef.current?.animateToRegion(
      { latitude: bus.latitude, longitude: bus.longitude, latitudeDelta: delta, longitudeDelta: delta },
      600,
    );
  }, [bus?.latitude, bus?.longitude, delta, follow]);

  if (Platform.OS === "web") {
    return (
      <View style={{ height: height || 280, backgroundColor: colors.mapNight, justifyContent: "center", padding: 22 }}>
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>
          Live map is available on iOS and Android. Open this screen on a device to follow the bus.
        </Text>
        <SimulatedBadge />
      </View>
    );
  }

  return (
    <View style={fill ? { flex: 1, backgroundColor: colors.mapNight } : { height: height || 280, backgroundColor: colors.mapNight }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        {...(Platform.OS === "android" ? { customMapStyle: darkStyle } : {})}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
      >
        {path.length > 1 ? <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={4} /> : null}
        {stops.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            title={s.name}
            pinColor={s.id === myStopId ? colors.warn : "#64748B"}
            tracksViewChanges={false}
          />
        ))}
        {asCoord(bus) ? (
          <Marker
            coordinate={bus}
            title="Bus"
            rotation={heading || 0}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges={false}
          >
            <View
              style={{
                width: expanded ? 22 : 18,
                height: expanded ? 22 : 18,
                borderRadius: 6,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.white,
                transform: [{ rotate: `${heading || 0}deg` }],
              }}
            />
          </Marker>
        ) : null}
      </MapView>

      <Pressable
        accessibilityLabel={expanded ? "Exit full screen" : "Full screen map"}
        onPress={onToggle}
        style={{
          position: "absolute",
          top: (expanded ? insets.top : 0) + 12,
          right: 14,
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#101828",
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Ionicons name={expanded ? "contract-outline" : "expand-outline"} size={18} color={colors.ink} />
      </Pressable>

      {expanded && title ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + 12,
            left: 14,
            right: 62,
            backgroundColor: "rgba(255,255,255,.92)",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : null}

      <SimulatedBadge />
    </View>
  );
}
