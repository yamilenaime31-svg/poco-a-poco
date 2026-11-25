import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { TabScreen } from "@/src/components/tab-screen";
import { AGENDA_CATS, MONTHS_LONG, fmtDate, fmtLongDate, isoDate, tintOf, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Chip, Empty, ErrorState, Fab, Ic, Loading, Row, Sheet, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

type View_ = "month" | "week" | "day" | "list";
const VIEWS: { k: View_; l: string }[] = [{ k: "month", l: "Mes" }, { k: "week", l: "Semana" }, { k: "day", l: "Día" }, { k: "list", l: "Lista" }];
const WD = ["L", "M", "M", "J", "V", "S", "D"];
const ADD = [
  { l: "Escribir con IA", i: "sparkles", kind: "ai" },
  { l: "Tratamiento con asistente", i: "wand-sparkles", kind: "assistant" },
  { l: "Evento o cita", i: "calendar", kind: "events" },
  { l: "Medicamento", i: "pill", kind: "medications" },
  { l: "Traslado", i: "car", kind: "transfers" },
  { l: "Pendiente", i: "list-checks", kind: "tasks" },
  { l: "Gasto", i: "wallet", kind: "expenses" },
];

const parse = (d: string) => new Date(`${d}T12:00:00`);
const shift = (d: string, days: number) => { const x = parse(d); x.setDate(x.getDate() + days); return isoDate(x); };
const mondayOf = (d: string) => shift(d, -((parse(d).getDay() + 6) % 7));

export default function Agenda() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ owner?: string }>();
  const { colors } = useTheme();
  const net = useApi<any>("/network");
  const t = today();
  const [owner, setOwner] = useState<string | null>(params.owner || null);
  const [view, setView] = useState<View_>("month");
  const [sel, setSel] = useState(t);
  const [month, setMonth] = useState(t.slice(0, 7));
  const [adding, setAdding] = useState(false);
  const [dose, setDose] = useState<any>(null);
  const linked = (net.data?.as_caregiver || []).filter((l: any) => l.status === "active");
  const ownerLink = linked.find((l: any) => l.patient_id === owner);
  const canEdit = !owner || ownerLink?.permissions?.edit;

  const [start, end] = useMemo(() => {
    if (view === "month") { const s = mondayOf(`${month}-01`); return [s, shift(s, 41)]; }
    if (view === "week") { const s = mondayOf(sel); return [s, shift(s, 6)]; }
    if (view === "day") return [sel, sel];
    return [t, shift(t, 60)];
  }, [view, month, sel, t]);
  const q = useApi<any[]>(`/agenda?start=${start}&end=${end}${owner ? `&owner_id=${owner}` : ""}`);
  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    (q.data || []).forEach((i) => (m[i.date] = [...(m[i.date] || []), i]));
    return m;
  }, [q.data]);

  const open = (i: any) => {
    tap();
    if (i.source === "doses") return setDose(i);
    if (i.source === "events") return router.push({ pathname: "/event/[id]", params: { id: i.id, owner_id: owner || "" } });
    router.push({ pathname: "/record-form", params: { kind: i.source, id: i.id } });
  };
  const setDoseStatus = async (status: string) => {
    try {
      await api("/doses", { method: "POST", body: { med_id: dose.id, date: dose.date, time: dose.time, status } });
      invalidate();
      toast.show(status === "realizado" ? "Registrado como realizado" : status === "omitido" ? "Registrado como omitido" : "Queda pendiente");
      setDose(null);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const add = (kind: string) => {
    setAdding(false);
    if (kind === "ai") return router.push("/(tabs)/organiza");
    if (kind === "assistant") return router.push("/treatment-assistant");
    router.push({ pathname: "/record-form", params: { kind, date: view === "list" ? t : sel, owner_id: owner || "" } });
  };

  const dots = (d: string) => {
    const cats = [...new Set((byDay[d] || []).map((i) => i.category))].slice(0, 3);
    return (
      <View style={styles.dots}>
        {cats.map((c) => <View key={c} style={[styles.dot, { backgroundColor: tintOf(colors, AGENDA_CATS[c]?.tint).accent }]} />)}
      </View>
    );
  };

  const dayList = (d: string) => {
    const items = byDay[d] || [];
    if (!items.length) return <Txt v="caption" style={{ paddingVertical: space.md }} testID="agenda-day-empty">Nada registrado para este día.</Txt>;
    const groups: Record<string, any[]> = {};
    items.forEach((i) => (groups[i.category] = [...(groups[i.category] || []), i]));
    return Object.entries(groups).map(([c, list]) => (
      <View key={c} style={{ marginTop: space.md }}>
        <Txt v="label" style={{ marginBottom: 2 }}>{AGENDA_CATS[c]?.label || c}</Txt>
        {list.map((i, n) => (
          <Row key={i.key} icon={AGENDA_CATS[c]?.icon} tint={AGENDA_CATS[c]?.tint} title={i.title} last={n === list.length - 1} testID={`agenda-item-${i.key}`}
            subtitle={[i.time, i.location, i.source === "doses" ? (i.status === "pendiente" ? "Por registrar" : i.status === "realizado" ? "Realizado" : "Omitido") : null,
              i.source === "transfers" ? (i.confirmed ? "Confirmado" : "Por confirmar") : null, i.series_id ? "Serie" : null, i.shared ? "Compartido" : null].filter(Boolean).join(" · ")}
            onPress={() => open(i)} />
        ))}
      </View>
    ));
  };

  const month0 = parse(`${month}-01`);
  const chips = (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.divider }}>
      <View style={[styles.seg, { backgroundColor: colors.surfaceTertiary }]}>
        {VIEWS.map((v) => (
          <Pressable key={v.k} onPress={() => { tap(); setView(v.k); }} testID={`agenda-view-${v.k}`} style={[styles.segItem, view === v.k && { backgroundColor: colors.surfaceSecondary }]}>
            <Txt v="medium" style={{ fontSize: 13 }} color={view === v.k ? colors.onSurface : colors.muted}>{v.l}</Txt>
          </Pressable>
        ))}
      </View>
      {linked.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.sm }}>
          <Chip label="Mi agenda" selected={!owner} onPress={() => setOwner(null)} testID="agenda-owner-me" />
          {linked.map((l: any) => <Chip key={l.id} label={l.patient_name} selected={owner === l.patient_id} onPress={() => setOwner(l.patient_id)} testID={`agenda-owner-${l.patient_id}`} />)}
        </ScrollView>
      ) : null}
    </View>
  );

  const nav = (label: string, prev: () => void, next: () => void, id: string) => (
    <View style={styles.nav}>
      <Pressable onPress={prev} hitSlop={10} style={styles.navBtn} testID={`agenda-${id}-prev`}><Ic name="chevron-left" size={20} /></Pressable>
      <Txt v="title" style={{ flex: 1, textAlign: "center" }} testID={`agenda-${id}-label`}>{label}</Txt>
      <Pressable onPress={next} hitSlop={10} style={styles.navBtn} testID={`agenda-${id}-next`}><Ic name="chevron-right" size={20} /></Pressable>
    </View>
  );

  return (
    <TabScreen title="Agenda" testID="agenda-screen" sticky={chips} refreshing={q.isRefetching} onRefresh={q.refetch}
      overlay={(bc) => (
        <>
          {canEdit ? <Fab bottom={bc + 16} label="Agregar" onPress={() => setAdding(true)} testID="agenda-add-button" /> : null}
          <Sheet visible={adding} onClose={() => setAdding(false)} title="¿Qué quieres agregar?" testID="agenda-add-sheet">
            {ADD.filter((a) => !owner || !["ai", "assistant"].includes(a.kind)).map((a, i) => <Row key={a.kind} icon={a.i} tint={i < 2 ? "sage" : "sand"} title={a.l} onPress={() => add(a.kind)} testID={`agenda-add-${a.kind}`} last={i === ADD.length - 1} />)}
          </Sheet>
          <Sheet visible={!!dose} onClose={() => setDose(null)} title={dose?.title || ""} testID="dose-sheet">
            <Txt v="caption" style={{ marginBottom: space.lg }}>{dose ? `${fmtDate(dose.date)} · ${dose.time}${dose.dose ? ` · ${dose.dose}` : ""}` : ""}. Registra solo lo que realmente ocurrió; AMODO no asume nada.</Txt>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Btn label="Realizado" small onPress={() => setDoseStatus("realizado")} testID="dose-done" style={{ flex: 1 }} />
              <Btn label="Omitido" small variant="secondary" onPress={() => setDoseStatus("omitido")} testID="dose-skipped" style={{ flex: 1 }} />
              <Btn label="Pendiente" small variant="ghost" onPress={() => setDoseStatus("pendiente")} testID="dose-pending" style={{ flex: 1 }} />
            </View>
            <Btn label="Editar medicamento" small variant="ghost" icon="pencil" onPress={() => { const d = dose; setDose(null); router.push({ pathname: "/record-form", params: { kind: "medications", id: d.id } }); }} testID="dose-edit" style={{ marginTop: space.sm }} />
          </Sheet>
        </>
      )}>
      {q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : null}

      {view === "month" ? (
        <>
          {nav(`${MONTHS_LONG[month0.getMonth()]} ${month0.getFullYear()}`, () => setMonth(isoDate(new Date(month0.getFullYear(), month0.getMonth() - 1, 1)).slice(0, 7)), () => setMonth(isoDate(new Date(month0.getFullYear(), month0.getMonth() + 1, 1)).slice(0, 7)), "month")}
          <View style={styles.week}>{WD.map((w, i) => <Txt key={i} v="label" style={{ flex: 1, textAlign: "center" }}>{w}</Txt>)}</View>
          <View testID="agenda-month-grid">
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <View key={r} style={styles.week}>
                {[0, 1, 2, 3, 4, 5, 6].map((c) => {
                  const d = shift(start, r * 7 + c);
                  const inMonth = d.slice(0, 7) === month;
                  const on = d === sel;
                  return (
                    <Pressable key={d} onPress={() => { tap(); setSel(d); }} testID={`agenda-day-${d}`} accessibilityLabel={fmtLongDate(d)}
                      style={[styles.cell, on && { backgroundColor: colors.surfaceInverse }, !on && d === t && { borderColor: colors.sage, borderWidth: 1.5 }]}>
                      <Txt v="medium" style={{ fontSize: 14 }} color={on ? colors.onSurfaceInverse : inMonth ? colors.onSurface : colors.borderStrong}>{parse(d).getDate()}</Txt>
                      {dots(d)}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <Txt v="title" style={{ marginTop: space.lg }}>{fmtLongDate(sel)}</Txt>
          {q.isLoading ? <Loading /> : dayList(sel)}
        </>
      ) : view === "week" ? (
        <>
          {nav(`Semana del ${fmtDate(start)}`, () => setSel(shift(sel, -7)), () => setSel(shift(sel, 7)), "week")}
          <View style={styles.week}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const d = shift(start, i);
              const on = d === sel;
              return (
                <Pressable key={d} onPress={() => setSel(d)} testID={`agenda-week-${d}`} style={[styles.weekDay, { borderColor: colors.border }, on && { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse }]}>
                  <Txt v="label" color={on ? colors.onSurfaceInverse : colors.muted}>{WD[i]}</Txt>
                  <Txt v="title" color={on ? colors.onSurfaceInverse : colors.onSurface}>{parse(d).getDate()}</Txt>
                  {dots(d)}
                </Pressable>
              );
            })}
          </View>
          <Txt v="title" style={{ marginTop: space.lg }}>{fmtLongDate(sel)}</Txt>
          {q.isLoading ? <Loading /> : dayList(sel)}
        </>
      ) : view === "day" ? (
        <>
          {nav(fmtLongDate(sel), () => setSel(shift(sel, -1)), () => setSel(shift(sel, 1)), "day")}
          {q.isLoading ? <Loading /> : dayList(sel)}
        </>
      ) : q.isLoading ? <Loading /> : !(q.data || []).length ? (
        <Empty icon="calendar" title="Agenda libre" text={owner ? "Aún no hay nada compartido contigo en estas fechas." : "Agrega citas, sesiones, medicamentos o actividades que disfrutes."} testID="agenda-empty" />
      ) : (
        Object.keys(byDay).sort().map((d) => (
          <View key={d} style={{ marginTop: space.md }}>
            <Txt v="title">{fmtDate(d)}</Txt>
            {dayList(d)}
          </View>
        ))
      )}
      {owner ? <Txt v="caption" style={{ marginTop: space.xl }}>Ves solo lo que {ownerLink?.patient_name} decidió compartir contigo.</Txt> : null}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: "row", marginHorizontal: space.xl, marginBottom: space.sm, borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 36, borderRadius: radius.pill },
  nav: { flexDirection: "row", alignItems: "center", marginVertical: space.sm },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row", gap: 4, marginBottom: 4 },
  cell: { flex: 1, minWidth: 0, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  weekDay: { flex: 1, minWidth: 0, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", gap: 2 },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
