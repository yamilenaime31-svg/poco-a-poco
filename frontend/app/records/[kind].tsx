import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { KINDS, fmtDate, money } from "@/src/constants";
import { Badge, Card, Chip, Empty, ErrorState, Fab, Ic, Loading, Row, Screen, Txt, tap } from "@/src/ui";
import { space, useTheme } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function subtitleFor(kind: string, r: any) {
  switch (kind) {
    case "treatments":
      return [r.status, r.cycle_current && r.cycles_total ? `Ciclo ${r.cycle_current} de ${r.cycles_total}` : r.frequency, r.next_session ? `Próxima: ${fmtDate(r.next_session)}` : null].filter(Boolean).join(" · ");
    case "medications":
      return [r.dose, r.schedule].filter(Boolean).join(" · ");
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

export default function Records() {
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
      {def.note ? (
        <Card tint="lavender" style={{ marginBottom: space.lg }} testID="records-note">
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
            <Card key={x.l} style={{ flex: 1, padding: space.md }}>
              <Txt v="label">{x.l}</Txt>
              <Txt v="title" style={{ marginTop: 4, fontSize: 14 }} testID={`expenses-total-${x.l}`}>
                {money(x.v)}
              </Txt>
            </Card>
          ))}
        </View>
      ) : null}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : items.length === 0 ? (
        <Empty icon={def.icon} title={showDone ? "Nada marcado como hecho" : "Todavía no hay nada aquí"} text={def.empty} testID="records-empty" />
      ) : (
        items.map((r, i) => (
          <Row
            key={r.id}
            icon={kind === "tasks" ? undefined : def.icon}
            tint={i % 3 === 0 ? "sage" : i % 3 === 1 ? "lavender" : "coral"}
            title={kind === "journal" ? fmtDate(r.date) : r[def.titleKey] || "Sin nombre"}
            subtitle={subtitleFor(kind, r)}
            onPress={() => router.push({ pathname: "/record-form", params: { kind, id: r.id } })}
            testID={`record-row-${r.id}`}
            last={i === items.length - 1}
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
