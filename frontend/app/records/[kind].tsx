import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Spot } from "@/src/art";
import { KINDS, fmtDate, money, tintOf } from "@/src/constants";
import { Badge, Card, Chip, Empty, ErrorState, Fab, Ic, Loading, Row, Screen, Txt, tap } from "@/src/ui";
import { space, useTheme } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LOOK: Record<string, { spot: string; tint: string }> = {
  treatments: { spot: "treatments", tint: "lavender" }, medications: { spot: "medications", tint: "coral" }, tasks: { spot: "tasks", tint: "sage" },
  transfers: { spot: "transfers", tint: "butter" }, expenses: { spot: "expenses", tint: "sky" }, journal: { spot: "day", tint: "mauve" }, events: { spot: "calendar", tint: "lavender" },
};

function subtitleFor(kind: string, r: any) {
  switch (kind) {
    case "treatments":
      return [r.treatment_type && r.treatment_type !== r.name ? r.treatment_type : null, r.status, r.cycle_current && r.cycles_total ? `Ciclo ${r.cycle_current} de ${r.cycles_total}` : r.frequency, r.next_session ? `Próxima: ${fmtDate(r.next_session)}` : null].filter(Boolean).join(" · ");
    case "medications":
      return [r.dose, Array.isArray(r.times) ? r.times.join(", ") : r.times, r.schedule].filter(Boolean).join(" · ");
    case "tasks":
      return [r.date ? fmtDate(r.date) : null, r.owner_name ? `De ${r.owner_name}` : null, r.assignee_name].filter(Boolean).join(" · ");
    case "transfers":
      return [fmtDate(r.date), r.time, r.mode, r.driver].filter(Boolean).join(" · ");
    case "expenses":
      return [money(r.amount), r.category, r.paid_by ? `Pagó ${r.paid_by}` : null, r.shared ? "Compartido" : null].filter(Boolean).join(" · ");
    case "journal":
      return [r.energy, r.note].filter(Boolean).join(" · ");
    default:
      return [fmtDate(r.date), r.time, r.location].filter(Boolean).join(" · ");
  }
}

export default function RecordsRoute() {
  const p = useLocalSearchParams<any>();
  if (p.kind === "expenses") return <Redirect href={{ pathname: "/finances", params: { owner_id: p.owner_id } }} />;
  return <Records />;
}

function Records() {
  const { kind, owner_id, assigned } = useLocalSearchParams<{ kind: string; owner_id?: string; assigned?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const def = KINDS[kind] || KINDS.tasks;
  const [owner, setOwner] = useState(owner_id || "");
  const [showDone, setShowDone] = useState(false);
  const net = useApi<any>("/network");
  const linked = (net.data?.as_caregiver || []).filter((l: any) => l.status === "active");
  const qs = assigned === "me" ? "?assigned=me" : owner ? `?owner_id=${owner}` : "";
  const q = useApi<any[]>(`/records/${kind}${qs}`);
  let items = q.data || [];
  if (kind === "tasks") items = items.filter((t) => !!t.done === showDone);
  const ownerLink = linked.find((l: any) => l.patient_id === owner);
  const canAdd = assigned !== "me" && (!owner || ownerLink?.permissions?.edit);
  const title = assigned === "me" ? "Mis pendientes" : def.label;
  const look = LOOK[kind] || LOOK.events;

  const toggle = async (t: any) => {
    tap();
    await api(`/records/tasks/${t.id}`, { method: "PUT", body: { done: !t.done } });
    invalidate();
  };

  const totals = kind === "expenses" ? (q.data || []).reduce((a, e) => ({ all: a.all + Number(e.amount || 0), paid: a.paid + (e.status === "Pagado" ? Number(e.amount || 0) : 0) }), { all: 0, paid: 0 }) : null;

  return (
    <Screen
      title={title}
      subtitle={owner && ownerLink ? `Compartido por ${ownerLink.patient_name}` : undefined}
      testID={`records-${kind}-screen`}
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      overlay={canAdd ? <Fab bottom={insets.bottom + 16} label="Agregar" onPress={() => router.push({ pathname: "/record-form", params: { kind, owner_id: owner } })} testID="records-add-button" /> : null}
    >
      {(linked.length > 0 && assigned !== "me") || kind === "tasks" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginTop: -space.md, height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
          {kind === "tasks" ? (
            <>
              <Chip label="Por hacer" selected={!showDone} onPress={() => setShowDone(false)} testID="records-filter-open" />
              <Chip label="Hechos" selected={showDone} onPress={() => setShowDone(true)} testID="records-filter-done" />
            </>
          ) : null}
          {linked.length > 0 && assigned !== "me" ? (
            <>
              <Chip label="Míos" selected={!owner} onPress={() => setOwner("")} testID="records-owner-me" />
              {linked.map((l: any) => (
                <Chip key={l.id} label={l.patient_name} selected={owner === l.patient_id} onPress={() => setOwner(l.patient_id)} testID={`records-owner-${l.patient_id}`} />
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : null}
      {kind === "treatments" && canAdd ? (
        <Pressable onPress={() => router.push("/treatment-assistant")} testID="treatments-assistant-card" style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: 22, marginBottom: space.md, backgroundColor: colors.sageSoft, opacity: pressed ? 0.88 : 1 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}><Ic name="sparkles" size={18} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="title">Cuéntame sobre tu tratamiento</Txt>
            <Txt v="caption" color={colors.onSurface}>Escribe lo que te indicaron y te ayudo a organizarlo</Txt>
          </View>
          <Ic name="arrow-right" size={18} />
        </Pressable>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: tintOf(colors, look.tint).bg, borderRadius: 24, padding: space.lg, marginBottom: space.lg }} testID="records-hero">
        <Spot name={look.spot} size={64} pop={look.tint === "butter" ? colors.lavender : colors.butter} />
        <View style={{ flex: 1 }}>
          <Txt v="section">{q.data ? `${items.length} ${items.length === 1 ? "registro" : "registros"}` : title}</Txt>
          <Txt v="caption" color={colors.onSurface}>{def.empty}</Txt>
        </View>
      </View>
      {def.note ? (
        <Card style={{ marginBottom: space.lg }} testID="records-note">
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Ic name="info" size={18} />
            <Txt style={{ flex: 1, fontSize: 14 }}>{def.note}</Txt>
          </View>
        </Card>
      ) : null}
      {totals ? (
        <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.lg }} testID="expenses-totals">
          {[
            { l: "Total", v: totals.all },
            { l: "Pagado", v: totals.paid },
            { l: "Pendiente", v: totals.all - totals.paid },
          ].map((x) => (
            <Card key={x.l} style={{ flex: 1, padding: space.md, borderRadius: 16 }}>
              <Txt v="label">{x.l}</Txt>
              <Txt v="title" style={{ marginTop: 4, fontSize: 14 }} testID={`expenses-total-${x.l}`}>
                {money(x.v)}
              </Txt>
            </Card>
          ))}
        </View>
      ) : null}
      {totals && (q.data || []).length ? <Row icon="chart-no-axes-column" tint="sand" title="Ver análisis" subtitle="Comparativo por mes y por quién pagó" onPress={() => router.push({ pathname: "/expense-analysis", params: { owner_id: owner } })} testID="expenses-analysis-link" last /> : null}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : items.length === 0 ? (
        <Empty icon={def.icon} title={showDone ? "Nada marcado como hecho" : "Todavía no hay nada aquí"} text={def.empty} testID="records-empty" />
      ) : (
        items.map((r) => (
          <View key={r.id} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: space.md, marginBottom: space.sm }}>
          <Row
            icon={kind === "tasks" ? undefined : def.icon}
            tint={look.tint}
            title={kind === "journal" ? fmtDate(r.date) : r[def.titleKey] || "Sin nombre"}
            subtitle={subtitleFor(kind, r)}
            onPress={() => router.push({ pathname: "/record-form", params: { kind, id: r.id } })}
            testID={`record-row-${r.id}`}
            last
            right={
              kind === "tasks" ? (
                <Pressable onPress={() => toggle(r)} hitSlop={10} testID={`record-check-${r.id}`} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: r.done ? colors.sage : colors.borderStrong, backgroundColor: r.done ? colors.sage : "transparent", alignItems: "center", justifyContent: "center" }}>
                  <Ic name="check" size={14} color={r.done ? colors.onBrandPrimary : colors.muted} />
                </Pressable>
              ) : kind === "expenses" ? (
                <Badge label={r.status || "—"} tint={r.status === "Pagado" ? "sage" : "coral"} />
              ) : undefined
            }
          />
          </View>
        ))
      )}
      {kind === "tasks" && assigned !== "me" && user?.role === "caregiver" ? (
        <Pressable onPress={() => router.setParams({ assigned: "me" })} testID="records-assigned-link" style={{ marginTop: space.xl }}>
          <Txt v="medium" style={{ textDecorationLine: "underline" }}>
            Ver pendientes que me asignaron
          </Txt>
        </Pressable>
      ) : null}
      <View style={{ height: 72 }} />
    </Screen>
  );
}
