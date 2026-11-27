import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { Btn, Ic, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export function usePlus() {
  const q = useApi<any>("/me/plan");
  return { plus: q.data?.tier === "plus", loading: q.isLoading };
}

/** Small line under a Plus benefit so the person always knows what their membership gives them, also when Plus is already active. */
export function PlusTag({ why, testID, style }: { why: string; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, style]} testID={testID || "plus-tag"} accessibilityLabel={`Beneficio Plus: ${why}`}>
      <View style={[styles.pill, { backgroundColor: colors.lavender }]}>
        <Ic name="sparkles" size={11} />
        <Txt v="medium" style={{ fontSize: 11, lineHeight: 14 }}>Plus</Txt>
      </View>
      <Txt v="caption" color={colors.onSurface} style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>{why}</Txt>
    </View>
  );
}

/** Shows the Plus tool when active; otherwise a calm preview with "Conocer Plus" (never blocks the rest of the app). */
export function PlusGate({ title, text, why, preview, children, testID }: { title: string; text: string; why?: string; preview?: React.ReactNode; children: React.ReactNode; testID?: string }) {
  const { plus, loading } = usePlus();
  const router = useRouter();
  const { colors } = useTheme();
  if (loading) return null;
  if (plus) return <>{why ? <PlusTag why={why} style={{ marginTop: 0, marginBottom: space.md }} /> : null}{children}</>;
  return (
    <View testID={testID || "plus-gate"}>
      {preview ? <View style={{ opacity: 0.55 }} pointerEvents="none">{preview}</View> : null}
      <View style={[styles.box, { backgroundColor: colors.lavenderSoft }]}>
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
          <Ic name="sparkles" size={16} />
          <Txt v="title" style={{ flex: 1 }}>{title}</Txt>
        </View>
        <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>{text}</Txt>
        <Btn label="Conocer Plus" small variant="secondary" onPress={() => router.push("/plus")} testID="plus-gate-know" style={{ marginTop: space.md, alignSelf: "flex-start" }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  box: { borderRadius: radius.md, padding: space.lg, marginTop: space.md },
});
