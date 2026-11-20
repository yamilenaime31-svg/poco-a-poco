import { useState } from "react";
import { Pressable as _P, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { AdminScreen, tableRow } from "@/src/components/admin-ui";
import { money } from "@/src/constants";
import { Badge, Chip, Loading, Txt } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

const FILTERS = ["Todos", "Incluidos", "Premium", "Agotados", "Descontinuados"];

export default function AdminProducts() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any[]>("/admin/products");
  const [f, setF] = useState("Todos");
  const [s, setS] = useState("");
  const list = (q.data || []).filter((p) => {
    if (s && !`${p.name} ${p.sku}`.toLowerCase().includes(s.toLowerCase())) return false;
    if (f === "Incluidos") return p.tier !== "premium";
    if (f === "Premium") return p.tier === "premium";
    if (f === "Agotados") return p.status === "agotado" || (p.stock || 0) - (p.stock_reserved || 0) <= 0;
    if (f === "Descontinuados") return p.status === "descontinuado";
    return true;
  });
  return (
    <AdminScreen title="Artículos" subtitle={`${list.length} artículos · costos internos, no visibles para usuarios`} testID="admin-products">
      <TextInput value={s} onChangeText={setS} placeholder="Buscar por nombre o SKU" placeholderTextColor={colors.muted} testID="admin-products-search"
        style={{ height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: space.lg, fontFamily: fonts.body, color: colors.onSurface }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, padding: space.md, paddingHorizontal: space.xl }}>
        {FILTERS.map((x) => <Chip key={x} label={x} selected={f === x} onPress={() => setF(x)} testID={`admin-products-filter-${x}`} />)}
      </ScrollView>
      <View style={[tableRow(colors), { borderBottomColor: colors.borderStrong }]}>
        <Txt v="label" style={{ flex: 1 }}>Artículo</Txt>
        <Txt v="label" style={{ width: 64, textAlign: "right" }}>Costo</Txt>
        <Txt v="label" style={{ width: 52, textAlign: "right" }}>Stock</Txt>
      </View>
      {q.isLoading ? <Loading /> : list.map((p) => (
        <_P key={p.id} onPress={() => router.push({ pathname: "/admin/product/[id]", params: { id: p.id } })} testID={`admin-product-${p.id}`} style={tableRow(colors)}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="medium" style={{ fontSize: 14 }} numberOfLines={1}>{p.name}</Txt>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Txt v="caption" style={{ fontSize: 12 }}>{p.sku}</Txt>
              <Badge label={p.tier === "premium" ? `Premium +${money(p.supplement)}` : "Incluido"} tint={p.tier === "premium" ? "lavender" : "sage"} />
              {p.status !== "activo" ? <Badge label={p.status} tint="coral" /> : null}
            </View>
          </View>
          <Txt v="caption" style={{ width: 64, textAlign: "right" }}>{money((p.unit_cost || 0) + (p.prep_cost || 0))}</Txt>
          <Txt v="caption" style={{ width: 52, textAlign: "right" }} testID={`admin-stock-${p.id}`}>{(p.stock || 0) - (p.stock_reserved || 0)}{p.stock_reserved ? `+${p.stock_reserved}r` : ""}</Txt>
        </_P>
      ))}
    </AdminScreen>
  );
}
