import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { Spot } from "@/src/art";
import { today } from "@/src/constants";
import { DaySheet, WellbeingDays } from "@/src/components/process-parts";
import { Btn, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const PERIODS = [7, 30, 90];

/** Mi proceso on Home: interactive preview built from the same records as the full screen. */
export function ProcessPreview() {
  const router = useRouter();
  const { colors } = useTheme();
  const [days, setDays] = useState(7);
  const [day, setDay] = useState<any>(null);
  const q = useApi<any>(`/process?today=${today()}&days=${days}`);
  const d = q.data;
  const stats = d ? [
    { k: "feel", n: d.feelings.days_logged, l: "días con registro de bienestar", c: colors.sage },
    { k: "acts", n: d.activities.total, l: "actividades en tu agenda", c: colors.lavender },
    { k: "doses", n: d.medications.done, l: "tomas marcadas", c: colors.coral },
  ] : [];
  return (
    <Section title="Mi proceso" action="Ver todo" onAction={() => router.push("/process")} testID="home-process">
      <View style={[styles.seg, { backgroundColor: colors.surfaceTertiary }]}>
        {PERIODS.map((p) => (
          <Pressable key={p} onPress={() => setDays(p)} testID={`home-process-period-${p}`} accessibilityState={{ selected: days === p }} style={[styles.segItem, days === p && { backgroundColor: colors.surfaceInverse }]}>
            <Txt v="label" color={days === p ? colors.onSurfaceInverse : colors.onSurface}>{p} días</Txt>
          </Pressable>
        ))}
      </View>
      {!d ? <View style={{ minHeight: 96, justifyContent: "center" }}><Txt v="caption">{q.isError ? "No pudimos cargar tu proceso. Desliza para actualizar." : "Cargando…"}</Txt></View> : (
        <>
          <WellbeingDays daily={d.daily} selected={day?.date} onSelect={setDay} testID="home-process-days" />
          {d.empty ? <Txt v="caption" style={{ marginTop: space.sm }}>Tu proceso se irá construyendo contigo, a tu ritmo.</Txt> : null}
          <View style={styles.stats}>
            {stats.map((s) => (
              <Pressable key={s.k} onPress={() => router.push("/process")} testID={`home-process-stat-${s.k}`} style={({ pressed }) => [styles.stat, { backgroundColor: s.c, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Txt v="h2">{s.n}</Txt>
                <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12, lineHeight: 15 }}>{s.l}</Txt>
              </Pressable>
            ))}
          </View>
          {d.plus ? (
            <View style={[styles.report, { backgroundColor: colors.butter }]} testID="home-process-report">
              <Spot name="report" size={60} pop={colors.lavender} />
              <View style={{ flex: 1 }}>
                <Txt v="title">Tu proceso, en un reporte</Txt>
                <Txt v="caption" color={colors.onSurface}>Un resumen en PDF de lo que tú elijas, para ti o para compartirlo.</Txt>
                <Btn label="Generar mi reporte" small icon="file-text" onPress={() => router.push("/process-report")} testID="home-process-report-button" style={{ alignSelf: "flex-start", marginTop: space.sm }} />
              </View>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/plus")} testID="home-process-plus-hint" style={{ minHeight: 44, justifyContent: "center" }}>
              <Txt v="caption">Con Plus puedes llevar tu proceso a un reporte en PDF. Tus registros siempre son tuyos.</Txt>
            </Pressable>
          )}
        </>
      )}
      <DaySheet day={day} onClose={() => setDay(null)} />
    </Section>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: "row", borderRadius: radius.pill, padding: 4, marginBottom: space.md },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 40, borderRadius: radius.pill },
  stats: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  stat: { flex: 1, minWidth: 0, borderRadius: radius.lg, padding: space.md, minHeight: 92 },
  report: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: 24, padding: space.lg, marginTop: space.sm },
});
