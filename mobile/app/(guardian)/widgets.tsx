import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useEtas } from "../../src/api/hooks";
import { Button } from "../../src/components/ui/Button";
import { ScreenHeader } from "../../src/components/ui/ScreenHeader";
import { DEMO_NOTICES, requestPermission, sendDartNotice } from "../../src/notifications/push";
import { startRideLiveActivity } from "../../modules/dart-live-activity";
import { payloadFromEta } from "../../src/live/rideActivity";
import { LiveActivityLockCard, LockScreenBanner, MediumWidget, SmallWidget } from "../../src/widgets/WidgetPreview";
import { fallbackRiders, ridersFromEtas } from "../../src/widgets/snapshot";
import { colors, fonts } from "../../src/theme";

export default function Widgets() {
  const { data: etas } = useEtas();
  const riders = ridersFromEtas(etas);
  const preview = riders.length ? riders : fallbackRiders();
  const [sending, setSending] = useState<string | null>(null);

  async function previewNotice(kind: keyof typeof DEMO_NOTICES) {
    setSending(kind);
    const ok = await requestPermission();
    if (ok) await sendDartNotice(DEMO_NOTICES[kind]);
    setSending(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader back title="Home screen widgets" />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.5, color: colors.ink }}>
          Your riders, on the home screen
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: colors.muted }}>
          Small and medium widgets use the same arrival estimates as Today. Only your linked riders are shown.
        </Text>

        <Label>Small</Label>
        <View style={{ marginTop: 12, flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <SmallWidget rider={preview[0]} />
          {preview[1] ? <SmallWidget rider={preview[1]} /> : null}
        </View>

        <Label>Medium</Label>
        <View style={{ marginTop: 12 }}>
          <MediumWidget riders={preview} />
        </View>

        <Label>Live on lock screen</Label>
        <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.muted }}>
          While a route is running, DART pins an Uber-style Live Activity on the lock screen and in the Dynamic Island.
          It updates as the bus moves — not a one-off banner.
        </Text>
        <View
          style={{
            marginTop: 12,
            backgroundColor: colors.night,
            borderRadius: 22,
            padding: 18,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonts.heading,
              fontSize: 52,
              letterSpacing: -1.6,
              color: colors.white,
            }}
          >
            7:34
          </Text>
          <Text style={{ textAlign: "center", marginTop: 4, fontSize: 13, color: "rgba(255,255,255,.55)" }}>
            Saturday morning
          </Text>
          <View style={{ marginTop: 22 }}>
            <LiveActivityLockCard rider={preview[0]} />
          </View>
          <View style={{ marginTop: 12, gap: 10 }}>
            <LockScreenBanner rider={preview[0]} />
            {preview[1] ? <LockScreenBanner rider={preview[1]} muted /> : null}
          </View>
          <Text style={{ marginTop: 18, textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,.42)" }}>
            Live Activity on top · alerts underneath
          </Text>
        </View>

        <Label>Add a widget</Label>
        <Card>
          <Step n="1" title="Touch and hold the home screen" body="Until the apps start to jiggle." />
          <Step n="2" title="Tap Edit, then Add Widget" body="Search for DART in the gallery." />
          <Step n="3" title="Choose small or medium" body="The widget updates from the same live estimates as Track." />
        </Card>

        <Label>Preview on this iPhone</Label>
        <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.muted }}>
          Start the Live Activity, then lock the phone. You should see the ride card under the clock, like Uber.
        </Text>
        <View style={{ marginTop: 14, gap: 10 }}>
          <Button
            label="Pin Live Activity to lock screen"
            loading={sending === "live"}
            onPress={async () => {
              setSending("live");
              const first = etas?.[0];
              await startRideLiveActivity(
                first
                  ? payloadFromEta(first)
                  : {
                      studentId: "demo",
                      riderName: preview[0].name,
                      routeCode: preview[0].route,
                      stopName: preview[0].stop,
                      schoolName: "",
                      etaClock: preview[0].clock,
                      etaPeriod: preview[0].period,
                      delayLabel: preview[0].delay,
                      late: preview[0].late,
                      progress: 0.58,
                      statusLine: preview[0].late ? "Running late" : "On the way",
                      stopsAway: 2,
                      minutes: preview[0].late ? 6 : 4,
                    },
              );
              setSending(null);
            }}
          />
          <Button
            label="Route is running late"
            variant="secondary"
            loading={sending === "delay"}
            onPress={() => previewNotice("delay")}
          />
          <Button
            label="Bus has departed the depot"
            variant="secondary"
            loading={sending === "depot"}
            onPress={() => previewNotice("depot")}
          />
          <Pressable onPress={() => previewNotice("eta")} style={{ paddingVertical: 8 }}>
            <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.primary }}>
              One stop away
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={{ marginTop: 28, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.faint }}>
      {children}
    </Text>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: 18, paddingVertical: 15, borderTopWidth: n === "1" ? 0 : 1, borderTopColor: colors.hairline }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 99,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.ink }}>{title}</Text>
        <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>{body}</Text>
      </View>
    </View>
  );
}
