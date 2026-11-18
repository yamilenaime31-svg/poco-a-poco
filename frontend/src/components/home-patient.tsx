import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/avatar";
import { MoodCard } from "@/src/components/mood-card";
import { TileGrid } from "@/src/components/tile-grid";
import { TabScreen } from "@/src/components/tab-screen";
import { DEFAULT_FAV_SIGNALS, SIGNALS, URGENCY, fmtDate, fmtLongDate, tintOf, today } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Chip, ErrorState, Field, Ic, IconBtn, Loading, ProductImage, Row, Section, Sheet, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export const ORGANIZE_TILES = [
  { label: "Tratamientos", icon: "layers", href: "/records/treatments", tint: "sage" },
  { label: "Medicamentos", icon: "pill", href: "/records/medications", tint: "lavender" },
  { label: "Pendientes", icon: "list-checks", href: "/records/tasks", tint: "coral" },
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
      <Animated.View entering={FadeInDown.duration(400)}>
        <Txt v="h1" style={{ marginTop: space.sm }} testID="home-greeting">Hola, {user?.preferred_name || user?.name}.</Txt>
        <Txt v="caption">Un día a la vez, a tu modo.</Txt>
      </Animated.View>

      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
        <>
          <View style={[styles.day, { backgroundColor: colors.sageSoft }]} testID="home-my-day-card">
            <View style={[styles.blob, { backgroundColor: colors.sage }]} />
            <Txt v="label" color={colors.onSurface}>Mi día · {fmtLongDate(t)}</Txt>
            {d.today_events.length ? d.today_events.slice(0, 2).map((e: any) => (
              <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} testID={`home-today-${e.id}`}>
                <Txt v="h2" style={{ marginTop: 6, paddingRight: space.xl }} numberOfLines={2}>{e.time ? `${e.time} · ` : ""}{e.title}</Txt>
              </Pressable>
            )) : <Txt v="h2" style={{ marginTop: 6 }}>Tu día está libre hoy.</Txt>}
            <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>{d.tasks.length ? `${d.tasks.length} pendiente(s) por ahí, sin prisa` : "Sin pendientes"}</Txt>
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
              <Btn label="Ver mi día" small variant="secondary" onPress={() => router.push("/day")} testID="home-my-day-button" style={{ flex: 1 }} />
              <Btn label="Agregar" small icon="plus" onPress={() => router.push({ pathname: "/record-form", params: { kind: "events", date: t } })} testID="home-add-button" style={{ flex: 1 }} />
            </View>
          </View>

          <MoodCard journal={d.journal} date={t} />

          <Section title="Señales rápidas" action="Personalizar" onAction={() => setEditSignals(true)} testID="home-signals-section">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
              {favs.map((s) => (
                <Pressable key={s.type} onPress={() => { tap(); setUrgency("Cuando puedas"); setConfirm(s); }} testID={`home-signal-${s.type}`} style={({ pressed }) => ({ width: 70, alignItems: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}>
                  <View style={[styles.circle, { backgroundColor: tintOf(colors, s.tint).bg, borderColor: tintOf(colors, s.tint).accent }]}><Ic name={s.icon} size={19} /></View>
                  <Txt v="caption" color={colors.onSurface} style={{ textAlign: "center", marginTop: 6, fontSize: 12, lineHeight: 15 }} numberOfLines={3}>{s.label}</Txt>
                </Pressable>
              ))}
              <Pressable onPress={() => router.push("/signals")} testID="home-signals-more" style={{ width: 70, alignItems: "center" }}>
                <View style={[styles.circle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ic name="history" size={20} /></View>
                <Txt v="caption" style={{ textAlign: "center", marginTop: 6 }}>Historial</Txt>
              </Pressable>
            </ScrollView>
            {d.network_count === 0 ? <Txt v="caption" style={{ marginTop: space.sm }}>Vincula a alguien desde Perfil para que reciba tus señales.</Txt> : null}
          </Section>

          <Section title="Próximo" action="Agenda" onAction={() => router.push("/(tabs)/agenda")} testID="home-upcoming-section">
            {next ? (
              <Pressable onPress={() => router.push(`/event/${next.id}`)} testID="home-next-card" style={[styles.next, { backgroundColor: colors.lavenderSoft }]}>
                <View style={[styles.dateBox, { backgroundColor: colors.surfaceSecondary }]}>
                  <Txt v="label" color={colors.onSurface}>{fmtDate(next.date).split(" ")[0]}</Txt>
                  <Txt v="h2">{next.time || "—"}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title">{next.title}</Txt>
                  <Txt v="caption" color={colors.onSurface}>{[fmtDate(next.date), next.location].filter(Boolean).join(" · ")}</Txt>
                </View>
                <Ic name="chevron-right" size={18} />
              </Pressable>
            ) : <Txt v="caption">Nada programado por ahora.</Txt>}
          </Section>

          <Section title="Pendientes" action="Todos" onAction={() => router.push("/records/tasks")} testID="home-tasks-section">
            {d.tasks.length === 0 ? <Txt v="caption">Sin pendientes. Descansar también cuenta.</Txt> : d.tasks.slice(0, 3).map((task: any, i: number) => (
              <Row key={task.id} title={task.title} subtitle={task.date ? fmtDate(task.date) : undefined} onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: task.id } })} testID={`home-task-${task.id}`} last={i === Math.min(2, d.tasks.length - 1)}
                right={<Pressable onPress={() => toggleTask(task)} hitSlop={10} testID={`home-task-check-${task.id}`} style={[styles.check, { borderColor: colors.borderStrong }]}><Ic name="check" size={14} color={colors.muted} /></Pressable>} />
            ))}
          </Section>

          <Section title="Organiza" action="Abrir" onAction={() => router.push("/(tabs)/organiza")}>
            <TileGrid tiles={ORGANIZE_TILES.map((o) => ({ key: o.label, label: o.label, icon: o.icon, tint: o.tint, onPress: () => router.push(o.href as any), testID: `home-organize-${o.label}` }))} />
          </Section>

          <Section title="Mi kit" testID="home-kit-section">
            <View style={[styles.kit, { backgroundColor: colors.butterSoft }]}>
              {kit ? (
                <Pressable onPress={() => router.push(`/kit/${kit.id}`)} testID="home-kit-card" style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", width: 88, gap: 4 }}>
                    {kit.items.slice(0, 4).map((i: any) => <ProductImage key={i.product_id} product={i.product} height={42} style={{ width: 42, borderRadius: 14 }} />)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{kit.name}</Txt>
                    <Txt v="caption" color={colors.onSurface}>{kit.context} · {kit.items.length} artículos</Txt>
                  </View>
                </Pressable>
              ) : <Txt v="title">Prepara lo que te acompaña en tu próxima cita.</Txt>}
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                {kit ? <Btn label="Editar" small variant="secondary" icon="pencil" onPress={() => router.push({ pathname: "/kit-builder", params: { id: kit.id } })} testID="home-kit-edit" style={{ flex: 1 }} /> : null}
                <Btn label="Crear nuevo" small icon="package-plus" onPress={() => router.push("/kit-builder")} testID="home-build-kit-button" style={{ flex: 1 }} />
              </View>
            </View>
          </Section>
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  day: { marginTop: space.lg, borderRadius: radius.lg, padding: space.lg, overflow: "hidden" },
  blob: { position: "absolute", width: 72, height: 72, borderRadius: 36, right: -18, top: -22, opacity: 0.35 },
  circle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  next: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.lg, padding: space.md },
  dateBox: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  kit: { borderRadius: radius.lg, padding: space.lg },
});
