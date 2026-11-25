// AMODO motion language: slow, organic ambient loops and short interaction responses.
// Ambient motion stops when the device asks for reduced motion, when the person turns it off in
// Perfil → Configuración, when the screen is not focused and when the app is in the background.
import React, { useEffect, useState } from "react";
import { AppState, StyleProp, ViewStyle } from "react-native";
import { useIsFocused } from "expo-router";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { useAuth } from "@/src/auth";

/** False when motion must stay off (device setting or the person's own choice). */
export function useMotionAllowed() {
  const reduced = useReducedMotion();
  const { user } = useAuth();
  return !reduced && !user?.settings?.reduce_motion;
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setActive(s === "active"));
    return () => sub.remove();
  }, []);
  return active;
}

/** True only when ambient loops should actually run. */
export function useAmbient() {
  const allowed = useMotionAllowed();
  const focused = useIsFocused();
  const active = useAppActive();
  return allowed && focused && active;
}

export type Drift = {
  /** Full cycle in ms (3000–6000 for ambient). */
  cycle: number;
  /** Rest between cycles, ms. */
  pause?: number;
  delay?: number;
  /** "Breath" amplitudes (0 → 1 → 0 across the cycle). */
  sx?: number; sy?: number; ty?: number; tilt?: number;
  /** "Sway" amplitudes (left ↔ right across the cycle). */
  sway?: number; tx?: number;
};

/** Wraps children in a gentle loop. `play`: "loop" keeps going, "once" plays two cycles and rests, "off" stays still. */
export function Ambient({ drift, play = "loop", children, style }: { drift: Drift; play?: "loop" | "once" | "off"; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const on = useAmbient() && play !== "off";
  const p = useSharedValue(0);
  const { cycle, pause = 0, delay = 0, sx = 0, sy = 0, ty = 0, tilt = 0, sway = 0, tx = 0 } = drift;
  useEffect(() => {
    if (!on) {
      cancelAnimation(p);
      p.value = withTiming(0, { duration: 250 });
      return;
    }
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: cycle, easing: Easing.linear }), withDelay(pause, withTiming(0, { duration: 0 }))), play === "once" ? 2 : -1));
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, play, cycle, pause, delay]);
  const anim = useAnimatedStyle(() => {
    const b = (1 - Math.cos(p.value * 2 * Math.PI)) / 2;
    const s = Math.sin(p.value * 2 * Math.PI);
    return { transform: [{ translateX: tx * s }, { translateY: ty * b }, { rotate: `${tilt * b + sway * s}deg` }, { scaleX: 1 + sx * b }, { scaleY: 1 + sy * b }] };
  });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Short scale response whenever `trigger` changes (selection, item added…). Skipped on first render and when motion is off. */
export function Pop({ trigger, children, style, amount = 0.1 }: { trigger: any; children: React.ReactNode; style?: StyleProp<ViewStyle>; amount?: number }) {
  const allowed = useMotionAllowed();
  const s = useSharedValue(1);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (allowed) s.value = withSequence(withTiming(1 + amount, { duration: 120 }), withTiming(1, { duration: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
