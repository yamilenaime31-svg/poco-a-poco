import { StyleSheet, View } from "react-native";

import { Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** Horizontal bars: label · proportional bar · value. Purely descriptive, no scores. */
export function HBars({ rows, format, testID }: { rows: { label: string; value: number }[]; format?: (v: number) => string; testID?: string }) {
  const { colors } = useTheme();
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: space.sm }} testID={testID}>
      {rows.map((r) => (
        <View key={r.label}>
          <View style={styles.head}>
            <Txt v="caption" color={colors.onSurface} numberOfLines={1} style={{ flex: 1 }}>{r.label}</Txt>
            <Txt v="caption">{format ? format(r.value) : r.value}</Txt>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
            <View style={[styles.fill, { backgroundColor: colors.sage, width: `${Math.max(3, (r.value / top) * 100)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Vertical bars, one per week. */
export function WeekBars({ weeks, field, testID }: { weeks: any[]; field: string; testID?: string }) {
  const { colors } = useTheme();
  const top = Math.max(1, ...weeks.map((w) => w[field] || 0));
  const step = Math.ceil(weeks.length / 6);
  return (
    <View style={styles.weeks} testID={testID}>
      {weeks.map((w, i) => (
        <View key={w.start} style={styles.week}>
          <Txt v="caption" style={styles.small}>{w[field] ? Math.round(w[field]) : ""}</Txt>
          <View style={[styles.col, { backgroundColor: w[field] ? colors.sage : colors.surfaceTertiary, height: Math.max(3, ((w[field] || 0) / top) * 72) }]} />
          <Txt v="caption" style={styles.small} numberOfLines={1}>{i % step === 0 ? w.label : " "}</Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: space.sm, marginBottom: 4 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  weeks: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: space.sm },
  week: { flex: 1, alignItems: "center", justifyContent: "flex-end", minWidth: 0 },
  col: { width: "70%", borderRadius: 3, marginVertical: 3 },
  small: { fontSize: 10, lineHeight: 13 },
});
