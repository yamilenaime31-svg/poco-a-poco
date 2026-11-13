import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { TabScreen } from "@/src/components/tab-screen";
import { SIGNALS, fmtDate, fmtLongDate, tintOf, today } from "@/src/constants";
import { Btn, Card, ErrorState, Ic, Loading, Row, Section, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const BANNER = "https://images.unsplash.com/photo-1734606901353-5561d3c3ec72?crop=entropy&cs=srgb&fm=jpg&q=80&w=900";

const ORGANIZE = [
  { label: "Tratamientos", icon: "layers", href: "/records/treatments", tint: "sage" },
  { label: "Medicamentos", icon: "pill", href: "/records/medications", tint: "lavender" },
  { label: "Pendientes", icon: "list-checks", href: "/records/tasks", tint: "coral" },
  { label: "Traslados", icon: "car", href: "/records/transfers", tint: "sage" },
  { label: "Gastos", icon: "wallet", href: "/records/expenses", tint: "lavender" },
  { label: "Mi red", icon: "users", href: "/network", tint: "coral" },
];

export function PatientHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const t = today();
  const q = useApi<any>(`/home?today=${t}&role=patient`);
  const d = q.data?.role === "patient" ? q.data : undefined;

  const toggleTask = async (task: any) => {
    tap();
    await api(`/records/tasks/${task.id}`, { method: "PUT", body: { done: true } });
    invalidate();
  };

  return (
    <TabScreen unread={d?.unread} refreshing={q.isRefetching} onRefresh={q.refetch} testID="patient-home-screen">
      <Animated.View entering={FadeInDown.duration(400)}>
        <Txt v="h1" style={{ marginTop: space.sm }} testID="home-greeting">
          Hola, {user?.preferred_name || user?.name}.
        </Txt>
        <Txt v="caption" style={{ marginTop: 2 }}>
          {fmtLongDate(t)} · Un día a la vez, a tu modo.
        </Txt>
      </Animated.View>

      {q.isLoading || !d ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <Pressable onPress={() => router.push("/day")} testID="home-my-day-card" style={({ pressed }) => [styles.day, { backgroundColor: colors.sageSoft, opacity: pressed ? 0.9 : 1 }]}>
            <Image source={{ uri: BANNER }} style={[StyleSheet.absoluteFill, { opacity: 0.22 }]} contentFit="cover" />
            <Txt v="label" color={colors.onSurface}>
              Mi día
            </Txt>
            {d.today_events.length ? (
              <>
                <Txt v="h2" style={{ marginTop: space.sm }}>
                  {d.today_events[0].time ? `${d.today_events[0].time} · ` : ""}
                  {d.today_events[0].title}
                </Txt>
                <Txt v="caption" color={colors.onSurface}>
                  {d.today_events.length > 1 ? `y ${d.today_events.length - 1} más hoy` : d.today_events[0].location || "Hoy"}
                </Txt>
              </>
            ) : (
              <Txt v="h2" style={{ marginTop: space.sm }}>
                Tu día está libre hoy.
              </Txt>
            )}
            <View style={styles.dayFoot}>
              <Txt v="caption" color={colors.onSurface}>
                {d.tasks.length} pendiente(s) · {d.medications.length} medicamento(s) registrados
              </Txt>
              <Ic name="arrow-right" size={18} />
            </View>
          </Pressable>

          <Section title="Señales rápidas" action="Historial" onAction={() => router.push("/signals")} testID="home-signals-section">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -space.xl }} contentInset={{ left: 0 }}>
              <View style={{ width: space.xl - space.sm }} />
              {SIGNALS.map((s) => (
                <Pressable
                  key={s.type}
                  testID={`home-signal-${s.type}`}
                  onPress={() => router.push({ pathname: "/signals", params: { type: s.type } })}
                  style={({ pressed }) => [styles.signal, { backgroundColor: tintOf(colors, s.tint).bg, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                >
                  <Ic name={s.icon} size={22} />
                  <Txt v="medium" style={{ fontSize: 14, lineHeight: 18 }}>
                    {s.label}
                  </Txt>
                </Pressable>
              ))}
              <View style={{ width: space.xl - space.sm }} />
            </ScrollView>
            {d.network_count === 0 ? (
              <Txt v="caption" style={{ marginTop: space.sm }}>
                Aún no tienes acompañantes. Invita a alguien desde Mi red para que reciba tus señales.
              </Txt>
            ) : null}
          </Section>

          <Section title="Próximo" action="Ver agenda" onAction={() => router.push("/(tabs)/agenda")} testID="home-upcoming-section">
            {d.upcoming.length === 0 ? (
              <Txt v="caption">Nada programado por ahora.</Txt>
            ) : (
              d.upcoming.map((e: any, i: number) => (
                <Row key={e.id} icon="calendar" tint="sand" title={e.title} subtitle={`${fmtDate(e.date)}${e.time ? ` · ${e.time}` : ""}${e.location ? ` · ${e.location}` : ""}`} onPress={() => router.push(`/event/${e.id}`)} testID={`home-event-${e.id}`} last={i === d.upcoming.length - 1} />
              ))
            )}
          </Section>

          <Section title="Pendientes" action="Todos" onAction={() => router.push("/records/tasks")} testID="home-tasks-section">
            {d.tasks.length === 0 ? (
              <Txt v="caption">Sin pendientes. Descansar también cuenta.</Txt>
            ) : (
              d.tasks.map((task: any, i: number) => (
                <Row
                  key={task.id}
                  title={task.title}
                  subtitle={task.date ? fmtDate(task.date) : undefined}
                  onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: task.id } })}
                  testID={`home-task-${task.id}`}
                  last={i === d.tasks.length - 1}
                  right={
                    <Pressable onPress={() => toggleTask(task)} hitSlop={10} testID={`home-task-check-${task.id}`} style={[styles.check, { borderColor: colors.borderStrong }]}>
                      <Ic name="check" size={14} color={colors.muted} />
                    </Pressable>
                  }
                />
              ))
            )}
          </Section>

          <Section title="Organiza">
            <View style={styles.grid}>
              {ORGANIZE.map((o) => (
                <Pressable key={o.label} onPress={() => router.push(o.href as any)} testID={`home-organize-${o.label}`} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.8 : 1 }]}>
                  <View style={[styles.tileIcon, { backgroundColor: tintOf(colors, o.tint).bg }]}>
                    <Ic name={o.icon} size={18} />
                  </View>
                  <Txt v="medium" style={{ fontSize: 14 }}>
                    {o.label}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </Section>

          <Card tint="lavender" style={{ marginTop: space.xxl }} testID="home-kit-banner">
            <Txt v="label" color={colors.onSurface}>
              Kits
            </Txt>
            <Txt v="h2" style={{ marginTop: space.xs }}>
              Prepara lo que te acompaña en tu próxima sesión.
            </Txt>
            <Btn label="Armar un kit" small icon="package-plus" onPress={() => router.push("/kit-builder")} testID="home-build-kit-button" style={{ alignSelf: "flex-start", marginTop: space.md }} />
          </Card>
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  day: { marginTop: space.xl, borderRadius: radius.lg, padding: space.xl, overflow: "hidden", minHeight: 170 },
  dayFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.xl },
  signal: { width: 128, height: 112, borderRadius: radius.md, padding: space.md, justifyContent: "space-between", flexShrink: 0 },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "31.8%", borderRadius: radius.md, padding: space.md, gap: space.sm, minHeight: 92 },
  tileIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
