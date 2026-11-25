import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { Btn, Ic, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export function usePlus() {
  const q = useApi<any>("/me/plan");
  return { plus: q.data?.tier === "plus", loading: q.isLoading };
}

/** Shows the Plus tool when active; otherwise a calm preview with "Conocer Plus" (never blocks the rest of the app). */
export function PlusGate({ title, text, preview, children, testID }: { title: string; text: string; preview?: React.ReactNode; children: React.ReactNode; testID?: string }) {
  const { plus, loading } = usePlus();
  const router = useRouter();
  const { colors } = useTheme();
  if (loading) return null;
  if (plus) return <>{children}</>;
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

const styles = StyleSheet.create({ box: { borderRadius: radius.md, padding: space.lg, marginTop: space.md } });
