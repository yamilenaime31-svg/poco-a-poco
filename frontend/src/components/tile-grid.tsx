import { Pressable, StyleSheet, View } from "react-native";

import { Spot } from "@/src/art";
import { tintOf } from "@/src/constants";
import { Ic, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export type Tile = { key: string; label: string; icon: string; tint: string; onPress: () => void; testID?: string; spot?: string; hint?: string };

/** Two-column bento of colour modules: original spot illustration (or icon) on top, full label below (never truncated). */
export function TileGrid({ tiles }: { tiles: Tile[] }) {
  const { colors } = useTheme();
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r) => (
        <View key={r[0].key} style={styles.row}>
          {r.map((t) => {
            const c = tintOf(colors, t.tint);
            return (
              <Pressable key={t.key} testID={t.testID} accessibilityRole="button" accessibilityLabel={t.label}
                onPress={() => { tap(); t.onPress(); }}
                style={({ pressed }) => [styles.tile, { backgroundColor: c.bg, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <View style={styles.art}>
                  {t.spot ? <Spot name={t.spot} size={46} pop={t.tint === "butter" ? colors.lavender : colors.butter} /> : (
                    <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary }]}><Ic name={t.icon} size={18} /></View>
                  )}
                </View>
                <Txt v="title" style={styles.label}>{t.label}</Txt>
                {t.hint ? <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12, lineHeight: 16 }}>{t.hint}</Txt> : null}
              </Pressable>
            );
          })}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  tile: { flex: 1, minWidth: 0, minHeight: 108, padding: space.md, borderRadius: radius.lg, justifyContent: "flex-end" },
  art: { flex: 1, minHeight: 50, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, lineHeight: 19 },
});
