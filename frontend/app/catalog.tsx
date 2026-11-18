import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ProductCard } from "@/src/components/product-card";
import { CATEGORIES } from "@/src/constants";
import { Chip, Empty, ErrorState, Ic, IconBtn, Loading, Screen } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

export default function Catalog() {
  const params = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [cat, setCat] = useState(params.category || "");
  const [search, setSearch] = useState("");
  const qs = new URLSearchParams({ ...(cat ? { category: cat } : {}), ...(search.trim() ? { q: search.trim() } : {}) }).toString();
  const q = useApi<any[]>(`/products${qs ? `?${qs}` : ""}`);
  const favs = useApi<any[]>(user ? "/favorites" : null);
  const favIds = new Set((favs.data || []).map((f) => f.id));

  const toggleFav = async (id: string) => {
    if (!user) return router.push("/welcome");
    await api(`/favorites/${id}`, { method: "POST" });
    invalidate();
  };

  return (
    <Screen title="Catálogo" testID="catalog-screen" scroll={false} right={user ? <IconBtn icon="shopping-bag" onPress={() => router.push("/cart")} testID="catalog-cart-button" /> : undefined}>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>
        <View style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ic name="search" size={18} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Buscar artículos" placeholderTextColor={colors.muted} testID="catalog-search-input" returnKeyType="search" style={[styles.searchInput, { color: colors.onSurface }]} />
        </View>
      </View>
      <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.divider }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md }} testID="catalog-categories">
          <Chip label="Todo" selected={!cat} onPress={() => setCat("")} testID="catalog-cat-all" />
          {CATEGORIES.filter((c) => c.label !== "Detalles").map((c) => (
            <Chip key={c.label} label={c.label === "Antojos y preferencias" ? "Antojos" : c.label} selected={cat === c.label} onPress={() => setCat(c.label)} testID={`catalog-cat-${c.label}`} />
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.xl, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {q.isLoading ? <View style={{ width: "100%" }}><Loading /></View> : q.isError ? <View style={{ width: "100%" }}><ErrorState onRetry={() => q.refetch()} /></View> : (q.data || []).length === 0 ? (
          <View style={{ width: "100%" }}>
            <Empty icon="search" title="No encontramos artículos" text="Prueba con otra palabra o categoría." testID="catalog-empty" />
          </View>
        ) : (
          q.data!.map((p) => <ProductCard key={p.id} p={p} fav={favIds.has(p.id)} onFav={() => toggleFav(p.id)} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 48, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  searchInput: { flex: 1, minWidth: 0, height: 46, fontFamily: fonts.body, fontSize: 15 },
});
