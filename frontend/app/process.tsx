import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { PlusTag } from "@/src/components/plus-gate";
import { useApi } from "@/src/api";
import { Company, MoodFigure, Spot } from "@/src/art";
import { HBars, WeekBars } from "@/src/components/bars";
import { DaySheet, WellbeingDays, moodColor } from "@/src/components/process-parts";
import { fmtDate, money, today } from "@/src/constants";
import { useMotionAllowed } from "@/src/motion";
import { fmtTime, use24h } from "@/src/pickers";
import { Badge, Btn, Chip, ErrorState, Loading, Row, Screen, Section, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const PERIODS = [7, 30, 90];
const FILTERS = [{ k: "all", l: "Todo" }, { k: "feel", l: "Bienestar" }, { k: "acts", l: "Actividades" }, { k: "meds", l: "Medicamentos" }, { k: "money", l: "Gastos" }, { k: "notes", l: "Notas" }];
const STATUS_TINT: Record<string, string> = { programada: "lavender", registrada: "sage", cancelada: "sand" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const diff = (a: number, b: number, unit = "") => (a === b ? "igual que el periodo anterior" : `${Math.abs(a - b)}${unit} ${a > b ? "más" : "menos"} que el periodo anterior`);

/** Mi proceso: a personal dashboard built only from what the person registered. Descriptive, never an evaluation. */
export default function Process() {
  const router = useRouter();
  const { colors } = useTheme();
  const motion = useMotionAllowed();
  const h24 = use24h();
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState<any>(null);
  const [mood, setMood] = useState("");
  const q = useApi<any>(`/process?today=${today()}&days=${days}`);
  const d = q.data;
  const { user } = useAuth();
  const cg = user?.role === "caregiver";
  const care = useApi<any>(cg ? `/process/shared?today=${today()}&days=${days}` : null).data;
  const show = (k: string) => filter === "all" || filter === k;
  const top = d ? Math.max(1, ...d.feelings.moods.map((m: any) => m.value)) : 1;
  const moodDays = d && mood ? d.daily.filter((x: any) => x.moods.includes(mood)) : [];
  const tiles = d ? [
    { k: "feel", n: d.feelings.days_logged, l: `de ${d.days} días con registro de bienestar`, c: colors.sage, f: "feel" },
    { k: "appointments", n: d.activities.counts.appointments || 0, l: "citas y estudios en tu agenda", c: colors.sky, f: "acts" },
    { k: "treatments", n: d.activities.counts.treatments || 0, l: "sesiones de tratamiento", c: colors.lavender, f: "acts" },
    { k: "doses", n: d.medications.done, l: "tomas marcadas como realizadas", c: colors.coral, f: "meds" },
    { k: "tasks", n: d.tasks.done, l: `pendientes completados${d.tasks.open ? ` · ${d.tasks.open} abiertos` : ""}`, c: colors.mauve, f: "" },
    { k: "spent", n: money(d.expenses.total).replace(" MXN", ""), l: "en gastos registrados", c: colors.butter, f: "money" },
  ].filter((x) => !cg || !["treatments", "doses"].includes(x.k) || Number(x.n) > 0).map((x) => (cg && x.k === "appointments" ? { ...x, l: "actividades en tu agenda personal" } : x)) : [];

  return (
    <Screen title="Mi proceso" subtitle={cg ? "Tu experiencia de acompañar, a lo largo del tiempo" : "Tu experiencia a lo largo del tiempo, a tu modo"} testID="process-screen" refreshing={q.isRefetching} onRefresh={q.refetch}
      overlay={
        <>
          <DaySheet day={day} onClose={() => setDay(null)} />
          <Sheet visible={!!mood} onClose={() => setMood("")} title={mood} testID="process-mood-sheet">
            <Txt v="caption" style={{ marginBottom: space.sm }}>Días en los que registraste este estado. Toca uno para ver su detalle.</Txt>
            {moodDays.map((x: any, i: number) => <Row key={x.date} title={cap(fmtDate(x.date))} subtitle={x.moods.join(" · ")} onPress={() => { setMood(""); setDay(x); }} testID={`process-mood-day-${x.date}`} last={i === moodDays.length - 1} />)}
          </Sheet>
        </>
      }>
      <View style={[styles.seg, { backgroundColor: colors.surfaceTertiary }]}>
        {PERIODS.map((p) => (
          <Pressable key={p} onPress={() => setDays(p)} testID={`process-period-${p}`} accessibilityState={{ selected: days === p }} style={[styles.segItem, days === p && { backgroundColor: colors.surfaceInverse }]}>
            <Txt v="label" color={days === p ? colors.onSurfaceInverse : colors.onSurface}>Últimos {p} días</Txt>
          </Pressable>
        ))}
      </View>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
        <Animated.View key={days} entering={motion ? FadeIn.duration(220) : undefined}>
          <Txt v="caption" testID="process-period">{d.period}</Txt>
          {d.empty ? (
            <View style={[styles.empty, { backgroundColor: colors.lavenderSoft }]} testID="process-empty">
              <Company size={76} />
              <View style={{ flex: 1 }}>
                <Txt v="title">{cg ? "Tu experiencia de acompañar se irá construyendo contigo" : "Tu proceso se irá construyendo contigo"}</Txt>
                <Txt v="caption" color={colors.onSurface}>Aquí aparecerá lo que decidas registrar. No hay ritmo correcto.</Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm }}>
                  <Btn label="Cómo me siento hoy" small onPress={() => router.push("/(tabs)")} testID="process-empty-mood" />
                  <Btn label="Mi agenda" small variant="secondary" onPress={() => router.push("/(tabs)/agenda")} testID="process-empty-agenda" />
                </View>
              </View>
            </View>
          ) : null}

          {cg && care ? (
            <>
              <Section title="Tus responsabilidades de acompañamiento" testID="process-care-mine">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {[[care.mine.done, "tareas asignadas que completaste"], [care.mine.open, "tareas asignadas pendientes"], [care.mine.accompanied, "actividades compartidas contigo en el periodo"]].map(([n, l]) => (
                    <View key={String(l)} style={{ flexBasis: "30%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: space.md }}>
                      <Txt v="section">{n}</Txt>
                      <Txt v="caption" color={colors.onSurface}>{l}</Txt>
                    </View>
                  ))}
                </View>
                <Txt v="caption" style={{ marginTop: space.sm }}>Es solo un recuento de lo que registraste. No mide qué tan bien acompañas.</Txt>
              </Section>
              <Txt v="label" color={colors.onSurface} style={{ marginTop: space.lg }}>Tus registros personales</Txt>
              <Txt v="caption" style={{ marginBottom: space.sm }}>Tu bienestar, tu agenda y tus notas. No se mezclan con los de nadie más.</Txt>
            </>
          ) : null}

          <View style={styles.filters}>
            {FILTERS.map((f) => <Chip key={f.k} label={f.l} selected={filter === f.k} onPress={() => setFilter(f.k)} testID={`process-filter-${f.k}`} />)}
          </View>

          {filter === "all" ? (
            <View style={styles.bento} testID="process-tiles">
              {tiles.map((t, i) => (
                <Pressable key={t.k} testID={`process-tile-${t.k}`} onPress={() => (t.f ? setFilter(t.f) : router.push("/pending"))}
                  style={({ pressed }) => [styles.tile, i === 0 || i === 5 ? styles.wide : null, { backgroundColor: t.c, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                  <Txt v="section">{t.n}</Txt>
                  <Txt v="caption" color={colors.onSurface} style={{ flex: i === 0 || i === 5 ? 1 : undefined }}>{t.l}</Txt>
                </Pressable>
              ))}
            </View>
          ) : null}

          {show("feel") ? (
            <Section title="Bienestar" testID="process-feelings">
              <WellbeingDays daily={d.daily} selected={day?.date} onSelect={setDay} />
              {d.feelings.moods.length ? (
                <View style={{ marginTop: space.lg, gap: 6 }} testID="process-moods">
                  <Txt v="label" color={colors.onSurface}>Estados que registraste</Txt>
                  {d.feelings.moods.map((m: any) => (
                    <Pressable key={m.label} onPress={() => setMood(m.label)} testID={`process-mood-${m.label}`} accessibilityLabel={`${m.label}: ${m.value} días. Ver días`} style={styles.moodRow}>
                      <MoodFigure mood={m.label} size={34} color={moodColor(colors, m.label)} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Txt v="medium" style={{ fontSize: 14 }}>{m.label}</Txt><Txt v="caption">{m.value} día{m.value === 1 ? "" : "s"}</Txt></View>
                        <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}><View style={{ height: 8, borderRadius: 4, width: `${Math.max(4, (m.value / top) * 100)}%`, backgroundColor: moodColor(colors, m.label) }} /></View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : <Txt v="caption" style={{ marginTop: space.sm }}>Aún no hay estados registrados en este periodo. Registrar es opcional.</Txt>}
              {d.feelings.energy.length ? <View style={{ marginTop: space.lg }}><Txt v="label" color={colors.onSurface} style={{ marginBottom: space.sm }}>Energía</Txt><HBars rows={d.feelings.energy} format={(v) => `${v} día${v === 1 ? "" : "s"}`} /></View> : null}
              {d.feelings.signals.length ? <View style={{ marginTop: space.lg }}><Txt v="label" color={colors.onSurface} style={{ marginBottom: space.sm }}>Señales que enviaste</Txt><HBars rows={d.feelings.signals} /></View> : null}
            </Section>
          ) : null}

          {filter === "all" ? (
            d.compare ? (
              <View style={[styles.card, { backgroundColor: colors.surfaceSecondary }]} testID="process-compare">
                <Txt v="title">Comparado con los {d.days} días anteriores</Txt>
                <PlusTag why="Tu membresía compara este periodo con el anterior." testID="process-compare-plus" style={{ marginTop: 4, marginBottom: 6 }} />
                {[`Bienestar: registraste ${d.compare.now.feel_days} día(s), ${diff(d.compare.now.feel_days, d.compare.before.feel_days)}.`,
                  `Agenda: ${d.compare.now.activities} actividad(es), ${diff(d.compare.now.activities, d.compare.before.activities)}.`,
                  `Tomas marcadas: ${d.compare.now.doses_done}, ${diff(d.compare.now.doses_done, d.compare.before.doses_done)}.`,
                  `Gastos: ${money(d.compare.now.spent)}, ${d.compare.now.spent === d.compare.before.spent ? "igual que el periodo anterior" : `${money(Math.abs(d.compare.now.spent - d.compare.before.spent))} ${d.compare.now.spent > d.compare.before.spent ? "más" : "menos"} que el periodo anterior`}.`,
                ].map((x) => <Txt key={x} v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>{x}</Txt>)}
                <Txt v="caption" style={{ marginTop: 6 }}>Solo compara cuánto registraste; no evalúa cómo estás.</Txt>
              </View>
            ) : null
          ) : null}

          {show("acts") ? (
            <Section title="Línea del tiempo" testID="process-activities">
              <WeekBars weeks={d.weeks} field="activities" testID="process-activity-weeks" />
              <Txt v="caption" style={{ marginBottom: space.sm }}>Actividades por semana</Txt>
              {d.activities.events.length === 0 ? <Txt v="caption">Sin citas, tratamientos ni actividades en este periodo.</Txt> : [...d.activities.events].reverse().slice(0, 20).map((e: any, i: number, all: any[]) => (
                <Row key={e.id} icon={e.section === "treatments" ? "layers" : e.section === "appointments" ? "stethoscope" : "sun"} tint={e.section === "treatments" ? "lavender" : e.section === "appointments" ? "sky" : "butter"}
                  title={e.title || e.type} subtitle={[cap(fmtDate(e.date)), fmtTime(e.time, h24), e.type].filter(Boolean).join(" · ")} onPress={() => router.push(`/event/${e.id}`)} testID={`process-event-${e.id}`} last={i === all.length - 1}
                  right={<Badge label={cap(e.status)} tint={STATUS_TINT[e.status]} />} />
              ))}
              {d.activities.treatments.length ? <Txt v="label" color={colors.onSurface} style={{ marginTop: space.md }}>Tratamientos</Txt> : null}
              {d.activities.treatments.map((t: any, i: number) => (
                <Row key={`${t.name}-${i}`} icon="layers" tint="lavender" title={t.name} subtitle={[t.status, t.cycle ? `Ciclo ${t.cycle}` : "", `${t.sessions} sesión(es) en el periodo`].filter(Boolean).join(" · ")} onPress={() => router.push("/records/treatments")} last={i === d.activities.treatments.length - 1} />
              ))}
            </Section>
          ) : null}

          {show("meds") ? (
            <Section title="Medicamentos" action="Ver" onAction={() => router.push("/records/medications")} testID="process-medications">
              {d.medications.done || d.medications.skipped ? (
                <>
                  <HBars rows={[{ label: "Tomas realizadas", value: d.medications.done }, { label: "Tomas omitidas", value: d.medications.skipped }]} testID="process-doses" />
                  {d.medications.by_med.map((m: any) => <Txt key={m.name} v="caption" style={{ marginTop: 4 }}>{m.name}: {m.realizado} realizadas · {m.omitido} omitidas</Txt>)}
                </>
              ) : <Txt v="caption">Sin tomas marcadas en este periodo.</Txt>}
              <Txt v="caption" style={{ marginTop: space.sm }}>Solo cuenta lo que marcaste; lo no marcado no significa que no se tomó.</Txt>
            </Section>
          ) : null}

          {show("money") ? (
            <Section title="Gastos" action="Análisis" onAction={() => router.push("/expense-analysis")} testID="process-expenses">
              {d.expenses.by_category.length ? (
                <>
                  <Txt v="h2">{money(d.expenses.total)}</Txt>
                  <Txt v="caption" style={{ marginBottom: space.md }}>Pagado: {money(d.expenses.paid)} · Pendiente: {money(d.expenses.pending)}</Txt>
                  <HBars rows={d.expenses.by_category} format={money} testID="process-expense-cats" />
                </>
              ) : <Txt v="caption">Sin gastos registrados en este periodo.</Txt>}
              {d.finance ? (
                <View style={[styles.card, { backgroundColor: colors.skySoft, marginTop: space.md }]} testID="process-finance">
                  <Txt v="title">En total: desembolso neto {money(d.finance.totals.net)}</Txt>
                  {d.finance.totals.pending_receive ? <Txt v="caption" color={colors.onSurface}>Reembolsos por recibir (estimado): {money(d.finance.totals.pending_receive)}</Txt> : null}
                  {d.finance.to_pay.map((x: any) => <Row key={x.id} title={`Por pagar: ${x.title}`} subtitle={`${cap(fmtDate(x.when))} · ${money(x.amount)}`} onPress={() => router.push({ pathname: "/expense-form", params: { id: x.id } })} last />)}
                  {d.finance.attention.map((x: any) => <Row key={x.id} title={`Trámite: ${x.title}`} subtitle={x.status} onPress={() => router.push({ pathname: "/expense-form", params: { id: x.id } })} last />)}
                  <Btn label="Ver Gastos" small variant="secondary" onPress={() => router.push("/finances")} testID="process-finance-open" style={{ alignSelf: "flex-start", marginTop: space.sm }} />
                </View>
              ) : null}
            </Section>
          ) : null}

          {show("notes") ? (
            <Section title="Notas personales" testID="process-notes">
              {d.feelings.notes.length === 0 ? <Txt v="caption">Sin notas en este periodo.</Txt> : [...d.feelings.notes].reverse().map((n: any) => (
                <Pressable key={n.date} onPress={() => setDay(d.daily.find((x: any) => x.date === n.date))} testID={`process-note-${n.date}`} style={[styles.note, { backgroundColor: colors.mauveSoft }]}>
                  <Txt v="label" color={colors.onSurface}>{cap(fmtDate(n.date))}</Txt>
                  <Txt>“{n.text}”</Txt>
                </Pressable>
              ))}
            </Section>
          ) : null}

          {cg && care ? care.people.map((pp: any) => (
            <View key={pp.patient_id} style={[styles.card, { backgroundColor: colors.skySoft, marginBottom: space.md }]} testID={`process-shared-${pp.patient_id}`}>
              <Badge label="Sección aparte · no son tus registros" tint="sky" />
              <Txt v="title" style={{ marginTop: 6 }}>Lo que {pp.name} comparte contigo</Txt>
              {pp.counts.length === 0 ? <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>{pp.name} no ha compartido registros contigo en este periodo.</Txt>
                : <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>{pp.counts.map((c: any) => `${c.n} ${c.label}`).join(" · ")}</Txt>}
              {pp.recent.map((e: any, i: number) => <Row key={e.id} icon="calendar" tint="sand" title={e.title} subtitle={[cap(fmtDate(e.date)), e.type].filter(Boolean).join(" · ")} onPress={() => router.push({ pathname: "/event/[id]", params: { id: e.id } })} testID={`process-shared-event-${e.id}`} last={i === pp.recent.length - 1} />)}
              <Txt v="caption" style={{ marginTop: 6 }}>Solo aparece lo que {pp.name} decidió compartir. Su bienestar y sus datos médicos no se muestran aquí salvo que los comparta.</Txt>
            </View>
          )) : null}

          <View style={[styles.report, { backgroundColor: colors.butter }]} testID="process-report-card">
            <Spot name="report" size={60} pop={colors.lavender} />
            <View style={{ flex: 1 }}>
              <Txt v="title">Tu proceso, en un reporte</Txt>
              <Txt v="caption" color={colors.onSurface}>{d.plus ? "Elige periodo y categorías, revisa la vista previa y descarga tu PDF." : "Con AMODO Plus puedes crear reportes en PDF. Todo lo que ves aquí sigue disponible con cualquier plan."}</Txt>
              <Btn label={d.plus ? "Generar mi reporte" : "Conocer Plus"} small variant={d.plus ? "primary" : "secondary"} icon={d.plus ? "file-text" : undefined} onPress={() => router.push(d.plus ? "/process-report" : "/plus")} testID="process-pdf" style={{ alignSelf: "flex-start", marginTop: space.sm }} />
              {d.plus ? <PlusTag why="Los reportes en PDF son parte de tu membresía." testID="process-pdf-plus" /> : null}
            </View>
          </View>
          <Row icon="history" tint="sand" title="Historial personal" subtitle="Cada registro, en orden" onPress={() => router.push("/history")} testID="process-history" last />
          <Txt v="caption" style={{ marginTop: space.md }}>{d.note}</Txt>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: "row", borderRadius: radius.pill, padding: 4, marginBottom: space.sm },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 40, borderRadius: radius.pill, paddingHorizontal: 4 },
  empty: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: 24, padding: space.lg, marginTop: space.sm },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  bento: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  tile: { width: "48%", flexGrow: 1, borderRadius: radius.lg, padding: space.md, minHeight: 88 },
  wide: { width: "100%", flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64 },
  moodRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  card: { borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
  note: { borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  report: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: 24, padding: space.lg, marginTop: space.xxl, marginBottom: space.sm },
});
