import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { LiveMood, MOOD_ART, MoodFigure } from "@/src/art";
import { MONTHS_LONG, money, tintOf, today } from "@/src/constants";
import { fmtFullDate, fmtTime, use24h } from "@/src/pickers";
import { Btn, Row, Sheet, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const WD = ["D", "L", "M", "M", "J", "V", "S"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dow = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).getDay();
export const moodColor = (colors: any, m: string) => tintOf(colors, MOOD_ART[m]?.tint || "sand").bg;
export const hasAny = (d: any) => d.moods.length || d.energy || d.note || d.events.length || d.doses_done || d.doses_skipped || d.spent || d.tasks_done;

/** One day: date, the figure of the first registered state (or a quiet empty mark), "+n" when there is more. */
function DayCell({ d, size, selected, onPress, showWeekday, testID }: { d: any; size: number; selected: boolean; onPress: () => void; showWeekday?: boolean; testID: string }) {
  const { colors } = useTheme();
  const m = d.moods[0];
  const more = d.moods.length - 1;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} testID={testID} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={`${fmtFullDate(d.date)}: ${d.moods.length ? d.moods.join(", ") : "sin registro de bienestar"}${d.events.length ? `, ${d.events.length} actividad(es)` : ""}`}
      style={[styles.cell, { minHeight: size + (showWeekday ? 40 : 24) }, selected && { backgroundColor: colors.surfaceSecondary, borderColor: colors.onSurface }]}>
      {showWeekday ? <Txt v="caption" style={styles.tiny}>{WD[dow(d.date)]}</Txt> : null}
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {m ? (selected ? <LiveMood mood={m} size={size} color={moodColor(colors, m)} /> : <MoodFigure mood={m} size={size} color={moodColor(colors, m)} />) : (
          <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong }} />
        )}
        {more > 0 ? <View style={[styles.more, { backgroundColor: colors.surfaceInverse }]}><Txt style={{ fontSize: 9, lineHeight: 12 }} color={colors.onSurfaceInverse}>+{more}</Txt></View> : null}
      </View>
      <Txt v={d.date === today() ? "label" : "caption"} color={colors.onSurface} style={styles.tiny}>{Number(d.date.slice(8, 10))}</Txt>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: d.events.length ? colors.onSurface : "transparent" }} />
    </Pressable>
  );
}

/** 7 days → one strip; 30 → Monday-first grid; 90 → one compact row per week. Never 30 or 90 figures in one line. */
export function WellbeingDays({ daily, selected, onSelect, testID = "process-days" }: { daily: any[]; selected?: string; onSelect: (d: any) => void; testID?: string }) {
  const { colors } = useTheme();
  if (daily.length <= 7)
    return <View style={styles.strip} testID={testID}>{daily.map((d) => <DayCell key={d.date} d={d} size={40} showWeekday selected={selected === d.date} onPress={() => onSelect(d)} testID={`${testID}-${d.date}`} />)}</View>;
  const compact = daily.length > 35;
  const cells: (any | null)[] = [...Array((dow(daily[0].date) + 6) % 7).fill(null), ...daily];
  while (cells.length % 7) cells.push(null);
  return (
    <View testID={testID}>
      {compact ? null : <View style={styles.strip}>{["L", "M", "M", "J", "V", "S", "D"].map((w, i) => <Txt key={i} v="caption" style={[styles.tiny, { flex: 1, textAlign: "center" }]}>{w}</Txt>)}</View>}
      {Array.from({ length: cells.length / 7 }, (_, r) => {
        const row = cells.slice(r * 7, r * 7 + 7);
        const first = row.find(Boolean);
        return (
          <View key={r} style={[styles.strip, { alignItems: "center" }]}>
            {compact ? <Txt v="caption" style={[styles.tiny, { width: 42 }]}>{Number(first.date.slice(8, 10))} {MONTHS_LONG[Number(first.date.slice(5, 7)) - 1].slice(0, 3)}</Txt> : null}
            {row.map((d, i) => d ? <DayCell key={d.date} d={d} size={compact ? 24 : 32} selected={selected === d.date} onPress={() => onSelect(d)} testID={`${testID}-${d.date}`} /> : <View key={i} style={{ flex: 1 }} />)}
          </View>
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong }} /><Txt v="caption" style={styles.tiny}>Sin registro</Txt>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.onSurface, marginLeft: space.sm }} /><Txt v="caption" style={styles.tiny}>Con actividades</Txt>
      </View>
    </View>
  );
}

/** Everything registered on one day, with ways to open or edit each record. Descriptive only. */
export function DaySheet({ day, onClose }: { day: any | null; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const h24 = use24h();
  const go = (to: any) => { onClose(); router.push(to); };
  const d = day;
  return (
    <Sheet visible={!!d} onClose={onClose} title={d ? cap(fmtFullDate(d.date)) : ""} testID="process-day-sheet">
      {d ? (
        <>
          {d.moods.length ? (
            <View style={styles.moods} testID="process-day-moods">
              {d.moods.map((m: string) => (
                <View key={m} style={[styles.mood, { backgroundColor: colors.surfaceSecondary }]}>
                  <LiveMood mood={m} size={34} color={moodColor(colors, m)} play="once" />
                  <Txt v="label" color={colors.onSurface}>{m}</Txt>
                </View>
              ))}
            </View>
          ) : <Txt v="caption">Sin registro de bienestar este día. Eso no dice nada sobre cómo estuviste.</Txt>}
          {d.energy ? <Txt v="caption" style={{ marginTop: space.sm }}>Energía: {d.energy}</Txt> : null}
          {d.note ? <View style={[styles.note, { backgroundColor: colors.mauveSoft }]}><Txt>“{d.note}”</Txt></View> : null}
          {d.events.map((e: any, i: number) => (
            <Row key={e.id} icon="calendar" tint="lavender" title={e.title || e.type} subtitle={[fmtTime(e.time, h24), e.type, cap(e.status)].filter(Boolean).join(" · ")} onPress={() => go(`/event/${e.id}`)} testID={`process-day-event-${e.id}`} last={i === d.events.length - 1} />
          ))}
          {d.doses_done || d.doses_skipped ? <Row icon="pill" tint="coral" title="Medicamentos" subtitle={`${d.doses_done} toma(s) realizadas · ${d.doses_skipped} omitidas`} onPress={() => go("/records/medications")} last /> : null}
          {d.tasks_done ? <Row icon="list-checks" tint="sage" title="Pendientes completados" subtitle={`${d.tasks_done}`} onPress={() => go("/pending")} last /> : null}
          {d.spent ? <Row icon="wallet" tint="sky" title="Gastos registrados" subtitle={money(d.spent)} onPress={() => go("/records/expenses")} last /> : null}
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {d.date === today() ? <Btn label="Cambiar cómo me siento hoy" small variant="secondary" icon="smile" onPress={() => go("/(tabs)")} testID="process-day-edit-mood" /> : null}
            <Btn label={d.journal_id ? "Editar nota y energía del día" : "Agregar una nota a este día"} small variant="secondary" icon="pencil" testID="process-day-edit-note"
              onPress={() => go({ pathname: "/record-form", params: d.journal_id ? { kind: "journal", id: d.journal_id } : { kind: "journal", date: d.date } })} />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: 2 },
  cell: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 1, borderRadius: radius.sm, borderWidth: 1.5, borderColor: "transparent", paddingVertical: 3 },
  tiny: { fontSize: 11, lineHeight: 14 },
  more: { position: "absolute", right: -5, top: -3, minWidth: 18, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  moods: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  mood: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: space.md, paddingLeft: 6, minHeight: 44, borderRadius: 22 },
  note: { borderRadius: radius.md, padding: space.md, marginTop: space.md, marginBottom: space.sm },
});
