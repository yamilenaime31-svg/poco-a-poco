import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDate, money, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Chip, Empty, ErrorState, Fab, Ic, Loading, Row, Screen, Txt, tap } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const FILTERS = [
  { k: "today", l: "Hoy" },
  { k: "next", l: "Próximos" },
  { k: "late", l: "Vencidos" },
  { k: "done", l: "Completados" },
  { k: "shared", l: "Compartidos" },
];
const ICON: Record<string, string> = { tasks: "list-checks", doses: "pill", transfers: "car", expenses: "wallet" };

export default function Pending() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = today();
  const [f, setF] = useState("today");
  const q = useApi<any[]>(`/pending?today=${t}`);
  const all = q.data || [];
  const items = all.filter((i) => {
    if (f === "done") return i.done;
    if (i.done) return false;
    if (f === "today") return !i.date || i.date === t;
    if (f === "next") return i.date > t;
    if (f === "late") return i.date && i.date < t;
    return i.shared;
  });

  const act = async (i: any, status?: string) => {
    tap();
    try {
      if (i.source === "tasks") await api(`/records/tasks/${i.id}`, { method: "PUT", body: { done: !i.done } });
      if (i.source === "transfers") await api(`/records/transfers/${i.id}`, { method: "PUT", body: { confirmed: !i.done } });
      if (i.source === "expenses") await api(`/records/expenses/${i.id}`, { method: "PUT", body: { status: i.done ? "Pendiente" : "Pagado" } });
      if (i.source === "doses") await api("/doses", { method: "POST", body: { med_id: i.id, date: i.date, time: i.time, status } });
      invalidate();
      toast.show(i.done ? "Vuelve a estar pendiente" : "Listo, lo marcamos");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  return (
    <Screen title="Pendientes" subtitle="Todo lo que requiere una acción, en un lugar" testID="pending-screen" refreshing={q.isRefetching} onRefresh={q.refetch}
      overlay={<Fab bottom={insets.bottom + 16} label="Agregar" onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks" } })} testID="pending-add-button" />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}>
        {FILTERS.map((x) => <Chip key={x.k} label={`${x.l}`} selected={f === x.k} onPress={() => setF(x.k)} testID={`pending-filter-${x.k}`} />)}
      </ScrollView>
      <Txt v="caption" style={{ marginTop: space.md }}>Las citas y sesiones viven en Agenda; aquí aparecen sus preparativos, traslados, pagos y medicamentos programados.</Txt>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : items.length === 0 ? (
        <Empty icon="leaf" title="Nada por aquí" text={f === "done" ? "Lo que completes aparecerá aquí." : "Sin pendientes en esta vista. Descansar también cuenta."} testID="pending-empty" />
      ) : (
        <View style={{ marginTop: space.sm }}>
          {items.map((i, n) => (
            <Row key={i.key} icon={ICON[i.source]} tint={i.source === "doses" ? "coral" : "sand"} title={i.title} last={n === items.length - 1} testID={`pending-${i.key}`}
              subtitle={[i.date ? fmtDate(i.date) : "Sin fecha", i.time, i.detail, i.amount ? money(i.amount) : null, i.source === "doses" && i.done ? (i.status === "realizado" ? "Realizado" : "Omitido") : null, i.date && i.date < t && !i.done ? "Vencido" : null].filter(Boolean).join(" · ")}
              onPress={() => i.source === "doses" ? router.push({ pathname: "/record-form", params: { kind: "medications", id: i.id } }) : router.push({ pathname: "/record-form", params: { kind: i.source, id: i.id } })}
              right={i.source === "doses" && !i.done ? (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={() => act(i, "realizado")} hitSlop={6} testID={`pending-dose-done-${i.key}`} style={[styles.pill, { borderColor: colors.borderStrong }]}><Txt v="caption" color={colors.onSurface}>Realizado</Txt></Pressable>
                  <Pressable onPress={() => act(i, "omitido")} hitSlop={6} testID={`pending-dose-skip-${i.key}`} style={[styles.pill, { borderColor: colors.borderStrong }]}><Txt v="caption" color={colors.onSurface}>Omitido</Txt></Pressable>
                </View>
              ) : i.source === "doses" ? (
                <Pressable onPress={() => act(i, "pendiente")} hitSlop={6} testID={`pending-dose-undo-${i.key}`} style={[styles.pill, { borderColor: colors.borderStrong }]}><Txt v="caption" color={colors.onSurface}>Deshacer</Txt></Pressable>
              ) : (
                <Pressable onPress={() => act(i)} hitSlop={10} testID={`pending-check-${i.key}`} accessibilityLabel={i.done ? "Marcar como pendiente" : "Marcar como hecho"}
                  style={[styles.check, { borderColor: i.done ? colors.sage : colors.borderStrong, backgroundColor: i.done ? colors.sage : "transparent" }]}>
                  <Ic name="check" size={14} color={i.done ? colors.onBrandPrimary : colors.muted} />
                </Pressable>
              )} />
          ))}
        </View>
      )}
      <View style={{ height: 72 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pill: { minHeight: 40, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
