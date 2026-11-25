import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { money } from "@/src/constants";
import { Ic, ProductImage, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export function ProductCard({ p, fav, onFav, onPress, selected, testID }: { p: any; fav?: boolean; onFav?: () => void; onPress?: () => void; selected?: boolean; testID?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress || (() => router.push(`/product/${p.id}`))} testID={testID || `product-card-${p.id}`} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}>
      <View>
        <ProductImage product={p} height={150} style={[selected ? { borderWidth: 2, borderColor: colors.onSurface } : undefined, p.available === false ? { opacity: 0.5 } : undefined]} />
        {p.image ? <View style={[styles.illus, { backgroundColor: colors.surfaceSecondary }]}><Txt v="caption" style={{ fontSize: 10, lineHeight: 12 }}>Imagen ilustrativa</Txt></View> : null}
        {onFav ? (
          <Pressable onPress={onFav} hitSlop={8} testID={`product-fav-${p.id}`} style={[styles.fav, { backgroundColor: colors.surfaceSecondary }]}>
            <Ic name="heart" size={16} color={fav ? colors.onSurface : colors.muted} />
            {fav ? <View style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sageDeep, top: 4, right: 4 }} /> : null}
          </Pressable>
        ) : null}
        {selected ? (
          <View style={[styles.fav, { backgroundColor: colors.surfaceInverse, left: 8, right: undefined }]}>
            <Ic name="check" size={16} color={colors.onSurfaceInverse} />
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Txt v="caption" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>{p.category}</Txt>
        <View style={[styles.tag, { backgroundColor: p.tier === "premium" ? colors.lavenderSoft : colors.surfaceTertiary }]} testID={`product-tier-${p.id}`}>
          <Txt v="caption" color={colors.onSurface} style={{ fontSize: 11, lineHeight: 14 }}>{p.tier === "premium" ? "Premium" : "Incluido"}</Txt>
        </View>
      </View>
      <Txt v="medium" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>{p.name}</Txt>
      {p.description ? <Txt v="caption" numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>{p.description}</Txt> : null}
      {p.colors?.length ? <Txt v="caption" numberOfLines={1} style={{ fontSize: 12 }}>{p.colors.length} variante{p.colors.length === 1 ? "" : "s"}: {p.colors.join(", ")}</Txt> : null}
      <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12, marginTop: 2 }}>
        {p.available === false ? "Agotado por ahora" : p.tier === "premium" && p.supplement ? `+${money(p.supplement)} en kit · ${money(p.price)} suelto` : `En kit sin costo extra · ${money(p.price)} suelto`}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: "48%", marginBottom: space.xl },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.sm, marginBottom: 2 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  illus: { position: "absolute", left: 6, bottom: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, opacity: 0.9 },
  fav: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
