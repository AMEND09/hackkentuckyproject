import { Image, Text, View } from "react-native";
import { colors, fonts, shadow } from "../theme";
import type { WidgetRider } from "./snapshot";

const mark = require("../../assets/brand/dart-mark.png");

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Image source={mark} style={{ width: 16, height: 16 }} resizeMode="contain" />
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: 11,
          letterSpacing: 0.4,
          color: light ? "rgba(255,255,255,.8)" : colors.ink,
        }}
      >
        DART
      </Text>
    </View>
  );
}

export function SmallWidget({ rider }: { rider: WidgetRider }) {
  return (
    <View
      style={{
        width: 158,
        height: 158,
        backgroundColor: colors.white,
        borderRadius: 22,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.card,
      }}
    >
      <BrandMark />
      <Text style={{ marginTop: 14, fontFamily: fonts.heading, fontSize: 34, letterSpacing: -1, color: colors.ink }}>
        {rider.clock}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>{rider.period}</Text>
      <View style={{ marginTop: "auto" }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
          {rider.name}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: rider.late ? colors.warn : colors.success }}>{rider.delay}</Text>
      </View>
    </View>
  );
}

export function MediumWidget({ riders }: { riders: WidgetRider[] }) {
  const a = riders[0];
  const b = riders[1];
  return (
    <View
      style={{
        width: 330,
        maxWidth: "100%",
        height: 158,
        backgroundColor: colors.white,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.card,
      }}
    >
      <BrandMark />
      <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
        {a ? <MediumCol rider={a} /> : null}
        {b ? <MediumCol rider={b} /> : <View style={{ flex: 1 }} />}
      </View>
    </View>
  );
}

function MediumCol({ rider }: { rider: WidgetRider }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 28, letterSpacing: -0.8, color: colors.ink }}>{rider.clock}</Text>
      <Text style={{ marginTop: 4, fontSize: 14, fontWeight: "600", color: colors.ink }}>{rider.name}</Text>
      <Text style={{ marginTop: 2, fontSize: 12, color: colors.muted }} numberOfLines={1}>
        {rider.stop} · {rider.route}
      </Text>
      <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "700", color: rider.late ? colors.warn : colors.success }}>
        {rider.delay}
      </Text>
    </View>
  );
}

export function LiveActivityLockCard({ rider }: { rider: WidgetRider }) {
  const minutes = rider.late ? 6 : 4;
  const pct = rider.late ? 0.62 : 0.38;
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,.16)",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.16)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Image source={mark} style={{ width: 14, height: 14 }} resizeMode="contain" />
        <Text style={{ marginLeft: 7, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4, color: "rgba(255,255,255,.88)" }}>
          DART
        </Text>
        <Text style={{ marginLeft: 8, fontSize: 11.5, fontWeight: "600", color: "rgba(255,255,255,.55)" }}>{rider.route}</Text>
        <Text style={{ marginLeft: "auto", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: "#FCA5A5" }}>LIVE</Text>
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.white }}>{rider.name}</Text>
          <Text style={{ marginTop: 3, fontSize: 13, fontWeight: "600", color: rider.late ? "#FBBF24" : "#6EE7B7" }}>
            {rider.late ? "Running late" : "On the way"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 34, letterSpacing: -1.2, color: colors.white, lineHeight: 34 }}>
              {minutes}
            </Text>
            <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,.6)" }}>min</Text>
          </View>
          <Text style={{ marginTop: 2, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
            {rider.clock} {rider.period}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 14, height: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,.16)", overflow: "hidden" }}>
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: rider.late ? "#F59E0B" : "#60A5FA",
            borderRadius: 99,
          }}
        />
      </View>
      <View style={{ marginTop: 10, flexDirection: "row" }}>
        <Text style={{ flex: 1, fontSize: 12.5, color: "rgba(255,255,255,.7)" }} numberOfLines={1}>
          {rider.stop}
        </Text>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: rider.late ? "#FBBF24" : "#6EE7B7" }}>{rider.delay}</Text>
      </View>
    </View>
  );
}

export function LockScreenBanner({ rider, muted = false }: { rider: WidgetRider; muted?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: muted ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.14)",
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.14)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Image source={mark} style={{ width: 16, height: 16 }} resizeMode="contain" />
        <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.4, color: "rgba(255,255,255,.8)" }}>DART</Text>
        <Text style={{ marginLeft: "auto", fontSize: 11.5, color: "rgba(255,255,255,.55)" }}>{muted ? "7:12 AM" : "now"}</Text>
      </View>
      <Text style={{ marginTop: 9, fontSize: 15, fontWeight: "600", color: colors.white }}>
        {rider.late ? `${rider.route} is running late` : `${rider.route} has departed the depot`}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,.78)" }}>
        {rider.late
          ? `About ${rider.delay.replace("+", "").trim()} behind. ${rider.name}'s pickup at ${rider.stop} is now estimated at ${rider.clock} ${rider.period}.`
          : `${rider.name}'s stop at ${rider.stop} is estimated at ${rider.clock} ${rider.period}.`}
      </Text>
    </View>
  );
}
