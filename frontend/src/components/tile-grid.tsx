import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { tintOf } from "@/src/constants";
import { Ic, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export type Tile = { key: string; label: string; icon: string; tint: string; onPress: () => void; testID?: string };

/** Compact two-column grid: equal-width rows, icon beside the label (stacked on narrow phones so words never split). */
export function TileGrid({ tiles }: { tiles: Tile[] }) {
  const { colors } = useTheme();
  const [gridW, setGridW] = useState(0);
  // Below ~150px per tile the icon moves above the label so long single words (e.g. "Entretenimiento") keep their full width.
  const stacked = gridW > 0 && (gridW - space.sm) / 2 < 150;
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View style={{ gap: space.sm }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
      {rows.map((r) => (
        <View key={r[0].key} style={styles.row}>
          {r.map((t) => {
            const tint = tintOf(colors, t.tint);
            return (
              <Pressable
                key={t.key}
                testID={t.testID}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                onPress={() => {
                  tap();
                  t.onPress();
                }}
                style={({ pressed }) => [styles.tile, stacked && styles.tileStacked, { backgroundColor: tint.bg, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ic name={t.icon} size={15} />
                </View>
                <Txt v="medium" style={styles.label}>{t.label}</Txt>
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
  tile: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 56, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: radius.md },
  tileStacked: { flexDirection: "column", alignItems: "flex-start", gap: 6 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { flexShrink: 1, fontSize: 13, lineHeight: 17 },
});
