import { SharedLists } from "@/src/components/shared-lists";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { api, invalidate, useApi } from "@/src/api";
import { Company, Spot } from "@/src/art";
import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/avatar";
import { MoodCard } from "@/src/components/mood-card";
import { TabScreen } from "@/src/components/tab-screen";
import { DEFAULT_FAV_SIGNALS, SIGNALS, URGENCY, fmtDate, fmtLongDate, tintOf, today } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Chip, ErrorState, Field, Ic, IconBtn, Loading, ProductImage, Row, Section, Sheet, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export const ORGANIZE_TILES = [
  { label: "Tratamientos", icon: "layers", href: "/records/treatments", tint: "lavender", spot: "treatments" },
  { label: "Medicamentos", icon: "pill", href: "/records/medications", tint: "coral", spot: "medications" },
  { label: "Pendientes", icon: "list-checks", href: "/pending", tint: "sage", spot: "tasks" },
  { label: "Traslados", icon: "car", href: "/records/transfers", tint: "butter", spot: "transfers" },
  { label: "Gastos", icon: "wallet", href: "/records/expenses", tint: "sky", spot: "expenses" },
  { label: "Mi red de apoyo", icon: "users", href: "/network", tint: "mauve", spot: "network" },
];

export function useSignalList() {
  const { user } = useAuth();
  const custom: any[] = user?.settings?.custom_signals || [];
  const all = [...SIGNALS.map((s) => ({ ...s })), ...custom.map((c) => ({ ...c, icon: "sparkles", tint: "butter" }))];
  const favIds: string[] = user?.settings?.signal_favorites || DEFAULT_FAV_SIGNALS;
  const favs = favIds.map((id) => all.find((s) => s.type === id)).filter(Boolean) as any[];
  return { all, favIds, favs, custom };
}

function SignalEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { updateMe } = useAuth();
  const toast = useToast();
  const { all, favIds, custom } = useSignalList();
  const [ids, setIds] = useState<string[]>(favIds);
  const [label, setLabel] = useState("");
  const move = (i: number, d: number) => {
    const n = [...ids];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setIds(n);
  };
  const save = async (extra?: any[], nextIds?: string[]) => {
    await updateMe({ settings: { signal_favorites: nextIds || ids, ...(extra ? { custom_signals: extra } : {}) } });
    toast.show("Tus señales se actualizaron");
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Mis señales" testID="signal-editor">
      <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Elige cuáles ver en Inicio y en qué orden.</Txt>
        {ids.map((id, i) => {
          const s = all.find((x) => x.type === id);
          if (!s) return null;
          return (
            <Row key={id} icon={s.icon} tint={s.tint} title={s.label} testID={`signal-fav-${id}`} right={
              <View style={{ flexDirection: "row", gap: 4 }}>
                {i > 0 ? <IconBtn icon="arrow-up" onPress={() => move(i, -1)} testID={`signal-up-${id}`} /> : null}
                <IconBtn icon="x" onPress={() => setIds(ids.filter((x) => x !== id))} testID={`signal-hide-${id}`} />
              </View>
            } />
          );
        })}
        <Txt v="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>Agregar</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {all.filter((s) => !ids.includes(s.type)).map((s) => (
            <Chip key={s.type} label={s.label} icon="plus" onPress={() => setIds([...ids, s.type])} testID={`signal-add-${s.type}`} />
          ))}
        </View>
        <Field label="Crear una señal propia" value={label} onChangeText={setLabel} placeholder="Ej. Pasa por la farmacia" testID="signal-custom-label" style={{ marginTop: space.lg }} />
        <Btn label="Crear y guardar" variant="secondary" small disabled={!label.trim()} onPress={() => {
          const c = { type: `c-${Date.now()}`, label: label.trim() };
          setIds([...ids, c.type]);
          setLabel("");
          save([...custom, c], [...ids, c.type]);
        }} testID="signal-custom-create" />
      </ScrollView>
      <Btn label="Guardar" onPress={() => save()} testID="signal-editor-save" style={{ marginTop: space.lg }} />
    </Sheet>
  );
}

export function PatientHome() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { colors } = useTheme();
  const t = today();
  const q = useApi<any>(`/home?today=${t}&role=patient`);
  const kits = useApi<any[]>("/kits");
  const d = q.data?.role === "patient" ? q.data : undefined;
  const { favs } = useSignalList();
  const [confirm, setConfirm] = useState<any>(null);
  const [urgency, setUrgency] = useState("Cuando puedas");
  const [editSignals, setEditSignals] = useState(false);
  const [sending, setSending] = useState(false);
  const next = d ? [...d.today_events, ...d.upcoming][0] : null;
  const kit = kits.data?.[0];
  const still = useReducedMotion();

  const send = async () => {
    setSending(true);
    try {
      const r = await api("/signals", { method: "POST", body: { type: confirm.type, label: confirm.label, urgency, message: "" } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(r.recipients ? `Enviada a ${r.recipients} persona(s) de tu red` : "Guardada. Aún no tienes acompañantes vinculados.");
      setConfirm(null);
      invalidate();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSending(false);
    }
  };
  const toggleTask = async (task: any) => {
    tap();
    await api(`/records/tasks/${task.id}`, { method: "PUT", body: { done: true } });
    invalidate();
    toast.show("Pendiente marcado como hecho");
  };

  return (
    <TabScreen
      unread={d?.unread}
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      testID="patient-home-screen"
      right={<Pressable onPress={() => router.push("/avatar")} testID="home-avatar-button" style={{ marginRight: space.sm }}><Avatar avatar={user?.profile?.avatar} name={user?.preferred_name} size={44} /></Pressable>}
      overlay={() => (
        <>
          <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title="¿Enviar esta señal?" testID="signal-confirm-sheet">
            {confirm ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg }}>
                  <View style={[styles.circle, { backgroundColor: tintOf(colors, confirm.tint).bg, width: 56, height: 56, borderRadius: 20 }]}><Ic name={confirm.icon} size={24} /></View>
                  <Txt v="h2" style={{ flex: 1 }}>{confirm.label}</Txt>
                </View>
                <SingleChoice label="¿Para cuándo?" options={URGENCY} value={urgency} onChange={(v) => setUrgency(v || "Cuando puedas")} testID="home-signal-urgency" />
                <Txt v="caption" style={{ marginBottom: space.lg }}>La recibirán tus acompañantes que tienen activadas tus señales.</Txt>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Btn label="Cancelar" variant="ghost" onPress={() => setConfirm(null)} testID="signal-confirm-cancel" style={{ flex: 1 }} />
                  <Btn label="Enviar" icon="send" loading={sending} onPress={send} testID="signal-confirm-send" style={{ flex: 1 }} />
                </View>
              </>
            ) : null}
          </Sheet>
          {editSignals ? <SignalEditor visible onClose={() => setEditSignals(false)} /> : null}
        </>
      )}
    >
      <Animated.View entering={still ? undefined : FadeInDown.duration(220)} style={{ marginTop: space.xs }}>
        <Txt v="caption">{cap(fmtLongDate(t))}</Txt>
        <Txt v="display" testID="home-greeting" numberOfLines={2}>Hola, {properName(user?.preferred_name || user?.name)}</Txt>
      </Animated.View>

      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
        <>
          <View style={[styles.day, { backgroundColor: colors.lavender }]} testID="home-my-day-card">
            <View style={styles.dayArt} pointerEvents="none"><Company size={112} a={colors.surfaceSecondary} b={colors.butter} c={colors.sage} /></View>
            <View style={styles.dayHead}>
              <Txt v="title">Mi día</Txt>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <IconBtn icon="calendar-days" onPress={() => router.push("/day")} testID="home-my-day-button" />
                <IconBtn icon="plus" onPress={() => router.push({ pathname: "/record-form", params: { kind: "events", date: t } })} testID="home-add-button" />
              </View>
            </View>
            {next ? (
              <Pressable onPress={() => router.push(`/event/${next.id}`)} testID="home-next-card" style={styles.nextRow}>
                <Txt v="caption" color={colors.onSurface}>Próxima actividad</Txt>
                <Txt v="section" numberOfLines={2} style={{ marginRight: 96 }}>{next.title}</Txt>
                <View style={[styles.when, { backgroundColor: colors.surfaceInverse }]}>
                  <Ic name="clock" size={13} color={colors.onSurfaceInverse} />
                  <Txt v="label" color={colors.onSurfaceInverse}>{next.date === t ? "Hoy" : fmtDate(next.date)}{next.time ? ` · ${next.time}` : ""}</Txt>
                </View>
              </Pressable>
            ) : (
              <View style={styles.nextRow} testID="home-day-empty">
                <Txt v="section" style={{ marginRight: 96 }}>Sin actividades registradas</Txt>
                <Txt v="caption" color={colors.onSurface} style={{ marginRight: 96 }}>Este espacio es tuyo. Agrega algo solo si quieres.</Txt>
              </View>
            )}
            <View style={styles.dayFoot}>
              <Pressable onPress={() => router.push("/pending")} testID="home-pending-count" style={[styles.pill, { backgroundColor: colors.surfaceSecondary }]}>
                <Ic name="list-checks" size={15} />
                <Txt v="label" color={colors.onSurface}>{d.tasks.length ? `${d.tasks.length} pendiente${d.tasks.length === 1 ? "" : "s"}` : "Sin pendientes"}</Txt>
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/agenda")} testID="home-agenda-link" style={[styles.pill, { backgroundColor: colors.surfaceSecondary }]}>
                <Ic name="calendar" size={15} />
                <Txt v="label" color={colors.onSurface}>Agenda</Txt>
              </Pressable>
            </View>
          </View>

          <MoodCard journal={d.journal} date={t} />

          <Section title="Señales rápidas" action="Personalizar" onAction={() => setEditSignals(true)} testID="home-signals-section">
            <View style={styles.grid}>
              {favs.map((s) => (
                <Pressable key={s.type} onPress={() => { tap(); setUrgency("Cuando puedas"); setConfirm(s); }} testID={`home-signal-${s.type}`} accessibilityRole="button" accessibilityLabel={`Enviar señal: ${s.label}`}
                  style={({ pressed }) => [styles.signal, { backgroundColor: tintOf(colors, s.tint).soft, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                  <View style={[styles.signalIcon, { backgroundColor: tintOf(colors, s.tint).bg }]}><Ic name={s.icon} size={17} /></View>
                  <Txt v="label" color={colors.onSurface} style={{ flex: 1 }}>{s.label}</Txt>
                </Pressable>
              ))}
              <Pressable onPress={() => router.push("/signals")} testID="home-signals-more" style={[styles.signal, { backgroundColor: colors.surfaceTertiary }]}>
                <View style={[styles.signalIcon, { backgroundColor: colors.surfaceSecondary }]}><Ic name="history" size={17} /></View>
                <Txt v="label" color={colors.onSurface} style={{ flex: 1 }}>Historial de señales</Txt>
              </Pressable>
            </View>
            {d.network_count === 0 ? (
              <Pressable onPress={() => router.push("/link")} testID="home-link-hint" style={styles.hint}>
                <Ic name="link" size={14} />
                <Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>Aún no hay nadie vinculado. Toca aquí para invitar a quien te acompaña.</Txt>
              </Pressable>
            ) : null}
          </Section>

          <Section title="A tu modo" testID="home-shortcuts">
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Pressable onPress={() => router.push("/(tabs)/mykits")} testID="home-organize-Mis kits" style={({ pressed }) => [styles.tall, { backgroundColor: colors.coral, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                <Spot name="kits" size={72} pop={colors.butter} />
                <View>
                  <Txt v="h2">Mis kits</Txt>
                  <Txt v="caption" color={colors.onSurface}>Lo que te acompaña</Txt>
                </View>
              </Pressable>
              <View style={{ flex: 1, gap: space.sm }}>
                {[{ l: "Próxima semana", h: "/next-week", c: colors.sky, s: "week" }, { l: "Mi red de apoyo", h: "/network", c: colors.sage, s: "network" }].map((o) => (
                  <Pressable key={o.l} onPress={() => router.push(o.h as any)} testID={`home-organize-${o.l}`} style={({ pressed }) => [styles.half, { backgroundColor: o.c, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                    <Txt v="title" style={{ flex: 1, fontSize: 15, lineHeight: 19 }}>{o.l}</Txt>
                    <Spot name={o.s} size={40} />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
              {[{ l: "Medicamentos", i: "pill", h: "/records/medications" }, { l: "Traslados", i: "car", h: "/records/transfers" }, { l: "Gastos", i: "wallet", h: "/records/expenses" }].map((o) => (
                <Pressable key={o.l} onPress={() => router.push(o.h as any)} testID={`home-organize-${o.l}`} style={({ pressed }) => [styles.mini, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.8 : 1 }]}>
                  <Ic name={o.i} size={18} />
                  <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12 }} numberOfLines={1}>{o.l}</Txt>
                </Pressable>
              ))}
            </View>
          </Section>

          <SharedLists hideEmpty />
          <Section title="Pendientes" action="Todos" onAction={() => router.push("/pending")} testID="home-tasks-section">
            {d.tasks.length === 0 ? <Txt v="caption">Sin pendientes. Descansar también cuenta.</Txt> : d.tasks.slice(0, 3).map((task: any, i: number) => (
              <Row key={task.id} title={task.title} subtitle={task.date ? fmtDate(task.date) : undefined} onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: task.id } })} testID={`home-task-${task.id}`} last={i === Math.min(2, d.tasks.length - 1)}
                right={<Pressable onPress={() => toggleTask(task)} hitSlop={10} testID={`home-task-check-${task.id}`} accessibilityLabel="Marcar como hecho" style={[styles.check, { borderColor: colors.borderStrong }]}><Ic name="check" size={14} color={colors.muted} /></Pressable>} />
            ))}
          </Section>

          <Section title="Mi kit" action={kit ? "Editar" : undefined} onAction={kit ? () => router.push({ pathname: "/kit-builder", params: { id: kit.id } }) : undefined} testID="home-kit-section">
            {kit ? (
              <Pressable onPress={() => router.push(`/kit/${kit.id}`)} testID="home-kit-card" style={[styles.kit, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {kit.items.slice(0, 3).map((i: any) => <ProductImage key={i.product_id} product={i.product} height={48} style={{ width: 48 }} />)}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title" numberOfLines={1}>{kit.name}</Txt>
                  <Txt v="caption" numberOfLines={1}>{kit.context} · {kit.items.length} artículos</Txt>
                </View>
                <Ic name="arrow-right" size={16} />
              </Pressable>
            ) : <Txt v="caption">Prepara lo que te acompaña en tu próxima cita.</Txt>}
            <Btn label="Crear nuevo kit" small variant="secondary" icon="package-plus" onPress={() => router.push("/kit-builder")} testID="home-build-kit-button" style={{ marginTop: space.sm, alignSelf: "flex-start" }} />
          </Section>
        </>
      )}
    </TabScreen>
  );
}

/** Shows a name with natural capitalisation even if it was typed in lower or upper case. */
function properName(n?: string) {
  if (!n) return "";
  return n.trim().split(/\s+/).map((w) => (w === w.toLowerCase() || w === w.toUpperCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

const styles = StyleSheet.create({
  day: { marginTop: space.md, borderRadius: 24, padding: space.lg, overflow: "hidden" },
  dayArt: { position: "absolute", right: -6, bottom: 44 },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextRow: { paddingTop: space.sm, paddingBottom: space.md, gap: 4, minHeight: 92 },
  when: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 30, borderRadius: 15, marginTop: 6 },
  dayFoot: { flexDirection: "row", gap: space.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: 22 },
  circle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  signal: { width: "48.5%", flexGrow: 1, minHeight: 60, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: space.sm },
  signalIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.sm, minHeight: 44 },
  tall: { flex: 1, minHeight: 172, borderRadius: radius.lg, padding: space.lg, justifyContent: "space-between" },
  half: { flex: 1, minHeight: 82, borderRadius: radius.lg, padding: space.md, flexDirection: "row", alignItems: "center", gap: space.sm },
  mini: { flex: 1, minWidth: 0, minHeight: 64, borderRadius: radius.md, padding: space.sm, alignItems: "center", justifyContent: "center", gap: 4 },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  kit: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.lg, padding: space.md },
});
