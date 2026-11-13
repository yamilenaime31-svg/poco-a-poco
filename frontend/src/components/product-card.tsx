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
        <ProductImage product={p} height={150} style={selected ? { borderWidth: 2, borderColor: colors.onSurface } : undefined} />
        {onFav ? (
          <Pressable onPress={onFav} hitSlop={8} testID={`product-fav-${p.id}`} style={[styles.fav, { backgroundColor: colors.surfaceSecondary }]}>
            <Ic name="heart" size={16} color={fav ? colors.onSurface : colors.muted} />
            {fav ? <View style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, top: 4, right: 4 }} /> : null}
          </Pressable>
        ) : null}
        {selected ? (
          <View style={[styles.fav, { backgroundColor: colors.surfaceInverse, left: 8, right: undefined }]}>
            <Ic name="check" size={16} color={colors.onSurfaceInverse} />
          </View>
        ) : null}
      </View>
      <Txt v="caption" style={{ marginTop: space.sm }}>
        {p.category}
      </Txt>
      <Txt v="medium" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>
        {p.name}
      </Txt>
      <Txt v="title" style={{ fontSize: 14, marginTop: 2 }}>
        {money(p.price)}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: "48%", marginBottom: space.xl },
  fav: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
