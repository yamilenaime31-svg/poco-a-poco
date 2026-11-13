import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { TabScreen } from "@/src/components/tab-screen";
import { SIGNALS, fmtDate, fmtDateTime, today } from "@/src/constants";
import { Badge, Card, Chip, Empty, ErrorState, Ic, Loading, Row, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export function CaregiverHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const q = useApi<any>(`/home?today=${today()}&role=caregiver`);
  const d = q.data?.role === "caregiver" ? q.data : undefined;
  const [pid, setPid] = useState<string | null>(null);
  const patients = d?.patients || [];
  const sel = patients.find((p: any) => p.patient_id === pid) || patients[0];
  const shared = (d?.shared_events || []).filter((e: any) => !sel || e.owner_id === sel.patient_id);

  return (
    <TabScreen unread={d?.unread} refreshing={q.isRefetching} onRefresh={q.refetch} testID="caregiver-home-screen">
      <Animated.View entering={FadeInDown.duration(400)}>
        <Txt v="h1" style={{ marginTop: space.sm }} testID="home-greeting">
          Hola, {user?.preferred_name || user?.name}.
        </Txt>
        <Txt v="caption">Lo que necesitas, cuando lo necesitas.</Txt>
      </Animated.View>
      {q.isLoading || !d ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : patients.length === 0 ? (
        <Card style={{ marginTop: space.xl }}>
          <Empty icon="link" title="Aún no te vinculas con nadie" text="Pide a la persona que acompañas su código de AMODO o envíale una solicitud por correo." action="Vincular a una persona" onAction={() => router.push("/network")} testID="caregiver-empty" />
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.lg, marginHorizontal: -space.xl, height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
            {patients.map((p: any) => (
              <Chip key={p.id} label={p.patient_name} icon="user-round" selected={sel?.patient_id === p.patient_id} onPress={() => setPid(p.patient_id)} testID={`caregiver-patient-${p.patient_id}`} />
            ))}
          </ScrollView>

          <Card style={{ marginTop: space.md }} testID="caregiver-requests-card">
            <View style={styles.head}>
              <Txt v="label">Solicitudes recibidas</Txt>
              <Badge label={`${d.signals.length} abiertas`} tint={d.signals.length ? "coral" : "sand"} testID="caregiver-requests-count" />
            </View>
            {d.signals.length === 0 ? (
              <Txt v="caption" style={{ marginTop: space.sm }}>
                Sin solicitudes nuevas por ahora.
              </Txt>
            ) : (
              d.signals.slice(0, 3).map((s: any, i: number) => {
                const def = SIGNALS.find((x) => x.type === s.type);
                return (
                  <Row key={s.id} icon={def?.icon || "bell"} tint={def?.tint} title={`${s.patient_name}: ${s.label}`} subtitle={`${s.urgency} · ${fmtDateTime(s.created_at)}${s.message ? `\n${s.message}` : ""}`} onPress={() => router.push("/signals")} testID={`caregiver-signal-${s.id}`} last={i === Math.min(2, d.signals.length - 1)} />
                );
              })
            )}
          </Card>

          <Section title="Mis pendientes" action="Ver todos" onAction={() => router.push({ pathname: "/records/[kind]", params: { kind: "tasks", assigned: "me" } })} testID="caregiver-tasks-section">
            {d.tasks.length === 0 ? <Txt v="caption">No tienes pendientes asignados.</Txt> : d.tasks.map((t: any, i: number) => <Row key={t.id} icon="list-checks" tint="coral" title={t.title} subtitle={t.date ? fmtDate(t.date) : undefined} onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: t.id } })} testID={`caregiver-task-${t.id}`} last={i === d.tasks.length - 1} />)}
          </Section>

          <Section title={`Agenda compartida${sel ? ` · ${sel.patient_name}` : ""}`} action="Abrir" onAction={() => router.push({ pathname: "/(tabs)/agenda", params: { owner: sel?.patient_id } })} testID="caregiver-shared-agenda">
            {!sel?.permissions?.events ? (
              <Txt v="caption">{sel?.patient_name} no comparte su agenda contigo.</Txt>
            ) : shared.length === 0 ? (
              <Txt v="caption">Sin eventos próximos.</Txt>
            ) : (
              shared.map((e: any, i: number) => <Row key={e.id} icon="calendar" tint="sand" title={e.title} subtitle={`${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ""}${e.location ? ` · ${e.location}` : ""}`} onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })} testID={`caregiver-event-${e.id}`} last={i === shared.length - 1} />)
            )}
          </Section>

          <Section title="Acompañar">
            <View style={styles.grid}>
              {[
                { label: "Crear un kit", icon: "gift", onPress: () => router.push({ pathname: "/kit-builder", params: { for_name: sel?.patient_name, for_user_id: sel?.patient_id } }) },
                { label: "Gastos compartidos", icon: "wallet", onPress: () => router.push({ pathname: "/records/[kind]", params: { kind: "expenses", owner_id: sel?.patient_id } }) },
                { label: "Traslados", icon: "car", onPress: () => router.push({ pathname: "/records/[kind]", params: { kind: "transfers", owner_id: sel?.patient_id } }) },
                { label: "Mi propia agenda", icon: "calendar-heart", onPress: () => router.push("/(tabs)/agenda") },
                { label: "Personas vinculadas", icon: "users", onPress: () => router.push("/network") },
                { label: "Solicitudes", icon: "inbox", onPress: () => router.push("/signals") },
              ].map((a) => (
                <Pressable key={a.label} onPress={a.onPress} testID={`caregiver-action-${a.label}`} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.8 : 1 }]}>
                  <Ic name={a.icon} size={20} />
                  <Txt v="medium" style={{ fontSize: 14 }}>
                    {a.label}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </Section>

          {d.own_events.length > 0 ? (
            <Section title="Mi agenda">
              {d.own_events.map((e: any, i: number) => <Row key={e.id} icon="calendar-heart" tint="lavender" title={e.title} subtitle={`${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ""}`} onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })} testID={`caregiver-own-event-${e.id}`} last={i === d.own_events.length - 1} />)}
            </Section>
          ) : null}
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "48.6%", borderRadius: radius.md, padding: space.lg, gap: space.md, minHeight: 92 },
});
