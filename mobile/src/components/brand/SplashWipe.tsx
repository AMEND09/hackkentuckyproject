import { useEffect, useRef } from "react";
import { Animated, Easing, Image, View } from "react-native";

const WORDMARK = require("../../../assets/brand/dart-wordmark.png");
const WIDTH = 260;
const HEIGHT = 78;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function SplashWipe({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const edge = useRef(new Animated.Value(0)).current;
  const readyRef = useRef(ready);
  const finished = useRef(false);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    let cancelled = false;

    const play = () => {
      reveal.setValue(0);
      fade.setValue(1);
      edge.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(reveal, { toValue: WIDTH, duration: 1288, easing: EASE, useNativeDriver: false }),
          Animated.sequence([
            Animated.timing(edge, { toValue: 1, duration: 196, useNativeDriver: false }),
            Animated.delay(1092),
            Animated.timing(edge, { toValue: 0, duration: 392, useNativeDriver: false }),
          ]),
        ]),
        Animated.delay(1176),
        Animated.timing(fade, { toValue: 0, duration: 336, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]).start(({ finished: ok }) => {
        if (!ok || cancelled || finished.current) return;
        if (readyRef.current) {
          finished.current = true;
          onDone();
        } else {
          play();
        }
      });
    };

    play();
    return () => {
      cancelled = true;
    };
  }, [edge, fade, onDone, reveal]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ width: WIDTH, height: HEIGHT, opacity: fade }}>
        <Animated.View style={{ width: reveal, height: HEIGHT, overflow: "hidden" }}>
          <Image source={WORDMARK} style={{ width: WIDTH, height: HEIGHT }} resizeMode="contain" />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -8,
            width: 3,
            height: HEIGHT + 16,
            borderRadius: 99,
            backgroundColor: "#2563EB",
            opacity: edge,
            transform: [{ translateX: Animated.subtract(reveal, 2) }],
          }}
        />
      </Animated.View>
    </View>
  );
}
