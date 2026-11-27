import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApi } from "@/src/api";
import { Spot } from "@/src/art";
import { useAuth } from "@/src/auth";
import { MoodCard } from "@/src/components/mood-card";
import { SharedLists } from "@/src/components/shared-lists";
import { ReceivedSummaries } from "@/src/finance/week-share";
import { TabScreen } from "@/src/components/tab-screen";
import { TileGrid } from "@/src/components/tile-grid";
import { SIGNALS, fmtDate, fmtDateTime, today } from "@/src/constants";
import { Badge, Btn, Card, Chip, ErrorState, Loading, Row, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

// Which answers of the companion's questionnaire bring each shortcut or section forward.
const TILE_FOR: Record<string, string[]> = {
  kit: ["Preparar objetos para el hospital", "Realizar compras"],
  money: ["Administrar gastos", "Dar seguimiento a seguros y reembolsos", "Gastos", "Seguros y reembolsos"],
  transfers: ["Coordinar traslados", "Traslados"],
  lists: ["Preparar objetos para el hospital", "Listas de preparación", "Preparar lo necesario para cada tratamiento"],
  agenda: ["Acompañar a consultas", "Acompañar a tratamientos", "Organizar citas", "Próximas citas", "Calendarios"],
  network: ["Coordinar a otros acompañantes", "Responsabilidades de otros acompañantes", "Distribuir responsabilidades", "Tareas compartidas"],
  signals: ["Brindar compañía y apoyo emocional", "Señales rápidas del paciente", "Necesidades del paciente"],
};
const SECTION_FOR: Record<string, string[]> = { signals: ["Señales rápidas del paciente", "Necesidades del paciente"], tasks: ["Pendientes", "Listas de pendientes"], agenda: ["Próximas citas", "Tratamientos", "Calendarios"] };

export function CaregiverHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const t = today();
  const q = useApi<any>(`/home?today=${t}&role=caregiver`);
  const d = q.data?.role === "caregiver" ? q.data : undefined;
  const [pid, setPid] = useState<string | null>(null);
  const patients = d?.patients || [];
  const sel = patients.find((p: any) => p.patient_id === pid) || patients[0];
  const shared = (d?.shared_events || []).filter((e: any) => !sel || e.owner_id === sel.patient_id);
  const care = d?.care;
  const picked: string[] = care ? [...(care.duties || []), ...(care.at_hand || []), ...(care.organize || []), ...(care.hard || [])] : [];
  const rank = (map: Record<string, string[]>, k: string) => (map[k] || []).some((x) => picked.includes(x)) ? 0 : 1;
  const who = sel?.patient_name;

  const tiles = [
    { k: "kit", label: `Preparar un kit${who ? ` para ${who}` : ""}`, icon: "gift", go: () => router.push({ pathname: "/kit-builder", params: who ? { for_name: who, for_user_id: sel.patient_id } : {} }) },
    ...(sel?.can_finance ? [{ k: "money", label: `Gastos y trámites de ${who}`, icon: "wallet", go: () => router.push({ pathname: "/finances", params: { owner_id: sel.patient_id } }) }] : []),
    ...(sel ? [{ k: "transfers", label: "Traslados compartidos", icon: "car", go: () => router.push({ pathname: "/records/[kind]", params: { kind: "transfers", owner_id: sel.patient_id } }) }] : []),
    { k: "lists", label: "Listas de preparación", icon: "clipboard-list", go: () => router.push("/checklists") },
    ...(sel ? [{ k: "agenda", label: `Agenda de ${who}`, icon: "calendar", go: () => router.push({ pathname: "/(tabs)/agenda", params: { owner: sel.patient_id } }) }] : []),
    { k: "network", label: "Personas vinculadas", icon: "users", go: () => router.push("/network") },
    ...(sel ? [{ k: "signals", label: "Solicitudes", icon: "inbox", go: () => router.push("/signals") }] : []),
  ].sort((a, b) => rank(TILE_FOR, a.k) - rank(TILE_FOR, b.k));

  const sections = !sel ? [] : [
    { k: "signals", node: (
      <Card key="signals" tint="sage" style={{ marginTop: space.md, borderRadius: 24 }} testID="caregiver-requests-card">
        <View style={styles.head}>
          <Txt v="title">Señales de {who}</Txt>
          <Badge label={`${d.signals.length} abiertas`} tint="sand" testID="caregiver-requests-count" />
        </View>
        {d.signals.length === 0 ? <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.sm }}>Sin solicitudes nuevas por ahora.</Txt> : d.signals.slice(0, 3).map((s: any, i: number) => {
          const def = SIGNALS.find((x) => x.type === s.type);
          return <Row key={s.id} icon={def?.icon || "bell"} tint="sand" title={`${s.patient_name}: ${s.label}`} subtitle={`${s.urgency} · ${fmtDateTime(s.created_at)}${s.message ? `\n${s.message}` : ""}`} onPress={() => router.push("/signals")} testID={`caregiver-signal-${s.id}`} last={i === Math.min(d.signals.length, 3) - 1} />;
        })}
      </Card>
    ) },
    { k: "tasks", node: (
      <Section key="tasks" title="Tareas que te asignaron" action="Ver todas" onAction={() => router.push({ pathname: "/records/[kind]", params: { kind: "tasks", assigned: "me" } })} testID="caregiver-tasks-section">
        {d.tasks.length === 0 ? <Txt v="caption">No tienes tareas asignadas.</Txt> : d.tasks.map((x: any, i: number) => <Row key={x.id} icon="list-checks" tint="coral" title={x.title} subtitle={x.date ? fmtDate(x.date) : undefined} onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: x.id } })} testID={`caregiver-task-${x.id}`} last={i === d.tasks.length - 1} />)}
      </Section>
    ) },
    { k: "agenda", node: (
      <Section key="agenda" title={`Próximas actividades compartidas`} action="Abrir" onAction={() => router.push({ pathname: "/(tabs)/agenda", params: { owner: sel?.patient_id } })} testID="caregiver-shared-agenda">
        {shared.length === 0 ? <Txt v="caption">{who} aún no comparte eventos próximos contigo.</Txt>
          : shared.map((e: any, i: number) => <Row key={e.id} icon="calendar" tint="sand" title={e.title} subtitle={`${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ""}${e.location ? ` · ${e.location}` : ""}`} onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })} testID={`caregiver-event-${e.id}`} last={i === shared.length - 1} />)}
      </Section>
    ) },
  ].sort((a, b) => rank(SECTION_FOR, a.k) - rank(SECTION_FOR, b.k));

  return (
    <TabScreen unread={d?.unread} refreshing={q.isRefetching} onRefresh={q.refetch} testID="caregiver-home-screen">
      <Animated.View entering={FadeInDown.duration(400)}>
        <Txt v="display" style={{ marginTop: space.xs }} testID="home-greeting">Hola, {user?.preferred_name || user?.name}.</Txt>
        <Txt v="caption">Tu día, lo que acompañas y un espacio para ti.</Txt>
      </Animated.View>
      {q.isLoading || !d ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          {!care ? (
            <Card tint="lavender" style={{ marginTop: space.lg, borderRadius: 24 }} testID="caregiver-complete-profile">
              <Txt v="title">Cuéntanos cómo acompañas</Txt>
              <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>Unas preguntas breves sobre tus responsabilidades, tu forma de organizarte y lo que necesitas tú. Con eso ordenamos tu Inicio.</Txt>
              <Btn label="Completar mi perfil de acompañante" small onPress={() => router.push("/onboarding")} testID="caregiver-complete-profile-button" style={{ alignSelf: "flex-start", marginTop: space.md }} />
            </Card>
          ) : null}

          <Txt v="section" style={{ marginTop: space.xl }} testID="caregiver-own-title">Para ti</Txt>
          <Txt v="caption" style={{ marginBottom: space.sm }}>Tu agenda, tus pendientes y cómo te sientes. Es tuyo y nadie más lo ve.</Txt>
          <MoodCard journal={d.journal} date={t} />
          <Section title="Mi día y mis responsabilidades" action="Mi agenda" onAction={() => router.push("/(tabs)/agenda")} testID="caregiver-own-day">
            {d.own_events.length === 0 && d.own_tasks.length === 0 ? <Txt v="caption">Sin actividades ni pendientes propios por ahora.</Txt> : null}
            {d.own_events.map((e: any) => <Row key={e.id} icon="calendar-heart" tint="lavender" title={e.title} subtitle={`${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ""}`} onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })} testID={`caregiver-own-event-${e.id}`} />)}
            {d.own_tasks.map((x: any) => <Row key={x.id} icon="list-checks" tint="butter" title={x.title} subtitle={x.date ? fmtDate(x.date) : "Pendiente"} onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: x.id } })} testID={`caregiver-own-task-${x.id}`} />)}
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
              <Btn label="Mi día" small variant="secondary" icon="sun" onPress={() => router.push("/day")} testID="caregiver-my-day" style={{ flex: 1 }} />
              <Btn label="Mi proceso" small variant="secondary" icon="chart-no-axes-column" onPress={() => router.push("/process")} testID="caregiver-my-process" style={{ flex: 1 }} />
            </View>
          </Section>

          <Txt v="section" style={{ marginTop: space.xl }} testID="caregiver-shared-title">{patients.length ? "Lo que acompañas" : "Acompañar"}</Txt>
          {patients.length === 0 ? (
            <Card style={{ marginTop: space.sm, borderRadius: 24 }} testID="caregiver-empty">
              <Spot name="network" size={56} />
              <Txt v="title" style={{ marginTop: space.sm }}>Aún no te vinculas con nadie</Txt>
              <Txt v="caption" style={{ marginTop: 4 }}>Cuando te vincules verás aquí solo lo que esa persona decida compartir contigo. Mientras tanto, tus herramientas personales ya funcionan.</Txt>
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                <Btn label="Escanear QR" small icon="scan-line" onPress={() => router.push("/scan")} testID="caregiver-empty-scan" style={{ flex: 1 }} />
                <Btn label="Enlace o código" small variant="secondary" icon="link" onPress={() => router.push("/link")} testID="caregiver-empty-link" style={{ flex: 1 }} />
              </View>
            </Card>
          ) : (
            <>
              <Txt v="caption">Solo ves lo que cada persona decide compartir contigo.</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm, marginHorizontal: -space.xl, height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
                {patients.map((p: any) => <Chip key={p.id} label={p.patient_name} icon="user-round" selected={sel?.patient_id === p.patient_id} onPress={() => setPid(p.patient_id)} testID={`caregiver-patient-${p.patient_id}`} />)}
              </ScrollView>
              {sections.map((s) => s.node)}
              <SharedLists ownerId={sel?.patient_id} ownerName={sel?.patient_name} />
              <ReceivedSummaries ownerId={sel?.patient_id} />
            </>
          )}

          <Section title="Accesos para acompañar" testID="caregiver-actions">
            <TileGrid tiles={tiles.map((a, i) => ({ key: a.k, label: a.label, icon: a.icon, onPress: a.go, tint: ["sage", "butter", "sky", "lavender", "coral", "mauve", "sand"][i % 7], testID: `caregiver-action-${a.k}` }))} />
          </Section>
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
