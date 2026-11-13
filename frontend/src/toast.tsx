import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, useTheme } from "@/src/theme";

type Tone = "default" | "error";
const ToastCtx = createContext<{ show: (msg: string, tone?: Tone) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: Tone; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((msg: string, tone: Tone = "default") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
          <Animated.View
            key={toast.key}
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(180)}
            testID="toast-message"
            style={[styles.toast, { backgroundColor: toast.tone === "error" ? colors.coral : colors.surfaceInverse }]}
          >
            <Text style={[styles.text, { color: toast.tone === "error" ? colors.onError : colors.onSurfaceInverse }]}>{toast.msg}</Text>
          </Animated.View>
        </View>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, maxWidth: 480 },
  text: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
});
