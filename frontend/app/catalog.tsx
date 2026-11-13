import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ProductCard } from "@/src/components/product-card";
import { CATEGORIES } from "@/src/constants";
import { Chip, Empty, ErrorState, Field, IconBtn, Loading, Screen } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

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
        <Field value={search} onChangeText={setSearch} placeholder="Buscar artículos" testID="catalog-search-input" returnKeyType="search" style={{ marginBottom: -space.lg }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0, borderBottomWidth: 0.5, borderBottomColor: colors.divider }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
        <Chip label="Todo" selected={!cat} onPress={() => setCat("")} testID="catalog-cat-all" />
        {CATEGORIES.map((c) => (
          <Chip key={c.label} label={c.label} icon={c.icon} selected={cat === c.label} onPress={() => setCat(c.label)} testID={`catalog-cat-${c.label}`} />
        ))}
      </ScrollView>
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
