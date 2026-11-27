import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, useApi } from "@/src/api";
import { PlusGate, usePlus } from "@/src/components/plus-gate";
import { AGENDA_CATS, fmtDate, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Card, ErrorState, Loading, Row, Screen, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** Mi próxima semana (Plus): the next seven days and what can be prepared, built only from what the person registered. */
export default function NextWeek() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { plus } = usePlus();
  const q = useApi<any>(plus ? `/next-week?today=${today()}` : null);
  const [busy, setBusy] = useState("");
  const d = q.data;

  const act = async (p: any) => {
    if (p.link) return router.push(p.link);
    setBusy(p.key);
    try {
      const c = await api("/checklists", { method: "POST", body: { event_id: p.create_for } });
      router.push(`/checklist/${c.id}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen title="Mi próxima semana" subtitle="Lo que viene y lo que puedes preparar" testID="next-week-screen" refreshing={q.isRefetching} onRefresh={plus ? q.refetch : undefined}>
      <PlusGate why="Incluido en tu membresía: tu semana anticipada y lo que conviene preparar, sin revisar día por día." title="Anticípate con AMODO Plus" text="Una vista de tus próximos siete días con citas, traslados y lo que conviene preparar. Tu agenda completa sigue disponible con cualquier plan."
        preview={<Card><Txt v="title">Jueves · Consulta 10:00</Txt><Txt v="caption">Organiza cómo llegar · Arma tu lista</Txt></Card>}>
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
          <>
            <View style={{ flexDirection: "row", gap: space.sm }} testID="next-week-summary">
              {[["Citas", d.summary.visits], ["Traslados", d.summary.transfers], ["Pendientes", d.summary.tasks], ["Tomas", d.summary.doses]].map(([l, n]) => (
                <View key={l} style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 0, borderRadius: 8, padding: space.sm }}>
                  <Txt v="h2">{n}</Txt>
                  <Txt v="caption" style={{ fontSize: 12 }} numberOfLines={1}>{l}</Txt>
                </View>
              ))}
            </View>

            <Section title="Puedes preparar" testID="next-week-prepare">
              {d.prepare.length === 0 ? <Txt v="caption">Nada pendiente de preparar esta semana. Descansar también cuenta.</Txt> : d.prepare.map((p: any) => (
                <Card key={p.key} style={{ marginBottom: space.sm }} testID={`next-week-prep-${p.key}`}>
                  <Txt v="title">{p.title}</Txt>
                  <Txt v="caption" style={{ marginTop: 2 }}>{p.text}</Txt>
                  <Btn label={p.action} small variant="secondary" loading={busy === p.key} onPress={() => act(p)} testID={`next-week-action-${p.key}`} style={{ alignSelf: "flex-start", marginTop: space.sm }} />
                </Card>
              ))}
            </Section>

            <Section title="Día por día" testID="next-week-days">
              {d.days.map((day: any) => (
                <View key={day.date} style={{ paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: colors.divider }} testID={`next-week-day-${day.date}`}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt v="medium">{day.weekday}</Txt>
                    <Txt v="caption">{fmtDate(day.date)}{day.doses ? ` · ${day.doses} toma${day.doses === 1 ? "" : "s"}` : ""}</Txt>
                  </View>
                  {day.items.length === 0 ? <Txt v="caption">Sin actividades registradas</Txt> : day.items.map((i: any, n: number) => (
                    <Row key={i.key} icon={AGENDA_CATS[i.category]?.icon} tint="sand" title={i.title} subtitle={[i.time, i.type, i.location].filter(Boolean).join(" · ")} last={n === day.items.length - 1}
                      onPress={() => (i.source === "events" ? router.push(`/event/${i.id}`) : router.push({ pathname: "/record-form", params: { kind: i.source, id: i.id } }))} testID={`next-week-item-${i.key}`} />
                  ))}
                </View>
              ))}
            </Section>
            <Btn label="Mis listas de preparación" variant="secondary" icon="list-checks" onPress={() => router.push("/checklists")} testID="next-week-checklists" style={{ marginTop: space.lg }} />
            <Txt v="caption" style={{ marginTop: space.lg }}>{d.note}</Txt>
          </>
        )}
      </PlusGate>
    </Screen>
  );
}
