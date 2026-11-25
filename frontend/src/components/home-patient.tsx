import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { api, invalidate, useApi } from "@/src/api";
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
  { label: "Tratamientos", icon: "layers", href: "/records/treatments", tint: "sage" },
  { label: "Medicamentos", icon: "pill", href: "/records/medications", tint: "lavender" },
  { label: "Pendientes", icon: "list-checks", href: "/pending", tint: "coral" },
  { label: "Traslados", icon: "car", href: "/records/transfers", tint: "sky" },
  { label: "Gastos", icon: "wallet", href: "/records/expenses", tint: "butter" },
  { label: "Mi red de apoyo", icon: "users", href: "/network", tint: "lavender" },
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
                  <View style={[styles.circle, { backgroundColor: tintOf(colors, confirm.tint).bg, width: 56, height: 56 }]}><Ic name={confirm.icon} size={24} /></View>
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
      <Animated.View entering={FadeInDown.duration(300)} style={styles.greetRow}>
        <Txt v="h2" testID="home-greeting" style={{ flex: 1 }} numberOfLines={1}>Hola, {properName(user?.preferred_name || user?.name)}</Txt>
        <Txt v="caption">{fmtLongDate(t)}</Txt>
      </Animated.View>

      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
        <>
          <View style={[styles.day, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="home-my-day-card">
            <View style={styles.dayHead}>
              <Txt v="label">Mi día</Txt>
              <View style={{ flexDirection: "row", gap: space.xs }}>
                <IconBtn icon="calendar-days" onPress={() => router.push("/day")} testID="home-my-day-button" />
                <IconBtn icon="plus" onPress={() => router.push({ pathname: "/record-form", params: { kind: "events", date: t } })} testID="home-add-button" />
              </View>
            </View>
            {next ? (
              <Pressable onPress={() => router.push(`/event/${next.id}`)} testID="home-next-card" style={styles.nextRow}>
                <View style={[styles.dateBox, { backgroundColor: colors.sageSoft }]}>
                  <Txt v="caption" color={colors.onSurface} style={{ fontSize: 11 }}>{next.date === t ? "Hoy" : fmtDate(next.date).split(" ").slice(0, 2).join(" ")}</Txt>
                  <Txt v="title">{next.time || "—"}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="caption">Próxima actividad</Txt>
                  <Txt v="title" numberOfLines={2}>{next.title}</Txt>
                </View>
                <Ic name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
            ) : <Txt v="title" style={{ marginTop: space.sm }}>Nada programado por ahora.</Txt>}
            <Pressable onPress={() => router.push("/pending")} testID="home-pending-count" style={[styles.dayFoot, { borderTopColor: colors.divider }]}>
              <Ic name="list-checks" size={15} color={colors.muted} />
              <Txt v="caption" style={{ flex: 1 }}>{d.tasks.length ? `${d.tasks.length} pendiente${d.tasks.length === 1 ? "" : "s"}` : "Sin pendientes"}</Txt>
              <Txt v="caption" color={colors.onSurface} style={{ textDecorationLine: "underline" }} onPress={() => router.push("/(tabs)/agenda")}>Agenda</Txt>
            </Pressable>
          </View>

          <Section title="Señales rápidas" action="Personalizar" onAction={() => setEditSignals(true)} testID="home-signals-section">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}>
              {favs.map((s) => (
                <Pressable key={s.type} onPress={() => { tap(); setUrgency("Cuando puedas"); setConfirm(s); }} testID={`home-signal-${s.type}`} style={({ pressed }) => [styles.signal, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                  <Ic name={s.icon} size={18} />
                  <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12, lineHeight: 15 }} numberOfLines={2}>{s.label}</Txt>
                </Pressable>
              ))}
              <Pressable onPress={() => router.push("/signals")} testID="home-signals-more" style={[styles.signal, { borderColor: colors.border }]}>
                <Ic name="history" size={18} color={colors.muted} />
                <Txt v="caption" style={{ fontSize: 12 }}>Historial</Txt>
              </Pressable>
            </ScrollView>
            {d.network_count === 0 ? <Txt v="caption" style={{ marginTop: space.sm }}>Vincula a alguien desde Perfil para que reciba tus señales.</Txt> : null}
          </Section>

          <MoodCard journal={d.journal} date={t} />

          <Section title="Accesos" testID="home-shortcuts">
            <View style={styles.grid}>
              {[...ORGANIZE_TILES, { label: "Mis kits", icon: "package", href: "/(tabs)/mykits" }, { label: "Armar un kit", icon: "package-plus", href: "/kit-builder" }, { label: "Próxima semana", icon: "calendar-range", href: "/next-week" }].map((o) => (
                <Pressable key={o.label} onPress={() => router.push(o.href as any)} testID={`home-organize-${o.label}`} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                  <Ic name={o.icon} size={18} />
                  <Txt v="caption" color={colors.onSurface} numberOfLines={1} style={{ fontSize: 12 }}>{o.label}</Txt>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Pendientes" action="Todos" onAction={() => router.push("/pending")} testID="home-tasks-section">
            {d.tasks.length === 0 ? <Txt v="caption">Sin pendientes. Descansar también cuenta.</Txt> : d.tasks.slice(0, 3).map((task: any, i: number) => (
              <Row key={task.id} title={task.title} subtitle={task.date ? fmtDate(task.date) : undefined} onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: task.id } })} testID={`home-task-${task.id}`} last={i === Math.min(2, d.tasks.length - 1)}
                right={<Pressable onPress={() => toggleTask(task)} hitSlop={10} testID={`home-task-check-${task.id}`} style={[styles.check, { borderColor: colors.borderStrong }]}><Ic name="check" size={14} color={colors.muted} /></Pressable>} />
            ))}
          </Section>

          <Section title="Mi kit" action={kit ? "Editar" : undefined} onAction={kit ? () => router.push({ pathname: "/kit-builder", params: { id: kit.id } }) : undefined} testID="home-kit-section">
            {kit ? (
              <Pressable onPress={() => router.push(`/kit/${kit.id}`)} testID="home-kit-card" style={[styles.kit, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {kit.items.slice(0, 3).map((i: any) => <ProductImage key={i.product_id} product={i.product} height={44} style={{ width: 44 }} />)}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title" numberOfLines={1}>{kit.name}</Txt>
                  <Txt v="caption" numberOfLines={1}>{kit.context} · {kit.items.length} artículos</Txt>
                </View>
                <Ic name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
            ) : <Txt v="caption">Prepara lo que te acompaña en tu próxima cita.</Txt>}
            <Btn label="Crear nuevo kit" small variant="secondary" icon="package-plus" onPress={() => router.push("/kit-builder")} testID="home-build-kit-button" style={{ marginTop: space.sm }} />
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

const styles = StyleSheet.create({
  greetRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: space.xs },
  day: { marginTop: space.md, borderRadius: radius.md, paddingHorizontal: space.lg, paddingTop: space.sm, borderWidth: StyleSheet.hairlineWidth },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.md },
  dateBox: { width: 56, height: 52, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  dayFoot: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
  circle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  signal: { width: 84, minHeight: 72, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, padding: space.sm, justifyContent: "space-between", gap: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "31.5%", minHeight: 60, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, padding: space.sm, justifyContent: "space-between", gap: 4 },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  kit: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.md, padding: space.md, borderWidth: StyleSheet.hairlineWidth },
});
