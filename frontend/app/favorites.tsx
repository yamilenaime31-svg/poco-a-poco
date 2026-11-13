import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { ProductCard } from "@/src/components/product-card";
import { money } from "@/src/constants";
import { Empty, Loading, Row, Screen, Section } from "@/src/ui";

export default function Favorites() {
  const router = useRouter();
  const favs = useApi<any[]>("/favorites");
  const kits = useApi<any[]>("/kits");
  const unfav = async (id: string) => {
    await api(`/favorites/${id}`, { method: "POST" });
    invalidate();
  };
  return (
    <Screen title="Biblioteca y favoritos" testID="favorites-screen">
      <Section title="Artículos favoritos" style={{ marginTop: 0 }}>
        {favs.isLoading ? <Loading /> : (favs.data || []).length === 0 ? (
          <Empty icon="heart" title="Aún no guardas favoritos" text="Toca el corazón en cualquier artículo para encontrarlo aquí." action="Explorar catálogo" onAction={() => router.push("/catalog")} testID="favorites-empty" />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {favs.data!.map((p) => (
              <ProductCard key={p.id} p={p} fav onFav={() => unfav(p.id)} />
            ))}
          </View>
        )}
      </Section>
      <Section title="Kits guardados">
        {(kits.data || []).length === 0 ? null : kits.data!.map((k, i) => <Row key={k.id} icon="package" tint="sage" title={k.name} subtitle={`${k.items.length} artículos · ${money(k.total)}`} onPress={() => router.push(`/kit/${k.id}`)} testID={`favorites-kit-${k.id}`} last={i === kits.data!.length - 1} />)}
      </Section>
    </Screen>
  );
}
