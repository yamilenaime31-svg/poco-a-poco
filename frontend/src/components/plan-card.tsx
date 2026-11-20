import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { fmtDate } from "@/src/constants";
import { Ic, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

/** Profile entry point: current plan and active benefits. */
export function PlanCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>("/me/plan");
  const p = q.data;
  return (
    <Pressable onPress={() => router.push("/plan")} testID="profile-plan-card" style={({ pressed }) => [styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: colors.sageSoft }]}><Ic name="sparkles" size={18} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="label">Mi plan y beneficios</Txt>
        <Txt v="title" testID="profile-plan-name">{p?.name || "…"}</Txt>
        <Txt v="caption" numberOfLines={2}>
          {p ? (p.benefits.length ? `${p.benefits.length} beneficio(s) activo(s)` : "Sin beneficios adicionales") + (p.until ? ` · vigente hasta ${fmtDate(p.until)}` : "") : ""}
        </Txt>
      </View>
      <Ic name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginTop: space.xl },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
