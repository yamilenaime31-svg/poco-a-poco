import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { TabScreen } from "@/src/components/tab-screen";
import { money } from "@/src/constants";
import { Btn, Ic, IconBtn, Loading, ProductImage, Row, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?crop=entropy&cs=srgb&fm=jpg&q=80&w=900";

export default function Kits() {
  const router = useRouter();
  const { colors } = useTheme();
  const kits = useApi<any[]>("/kits");
  const sugg = useApi<any[]>("/kits/suggested");
  const forYou = useApi<any>("/suggestions");
  const cart = useApi<any>("/cart");

  const links = [
    { label: "Catálogo", icon: "store", href: "/catalog" },
    { label: "Favoritos", icon: "heart", href: "/favorites" },
    { label: "Pedidos", icon: "truck", href: "/orders" },
  ];

  return (
    <TabScreen
      title="Kits"
      testID="kits-screen"
      refreshing={kits.isRefetching}
      onRefresh={() => {
        kits.refetch();
        cart.refetch();
      }}
      right={
        <View style={{ marginRight: space.sm }}>
          <IconBtn icon="shopping-bag" badge={!!cart.data?.count} onPress={() => router.push("/cart")} testID="kits-cart-button" />
        </View>
      }
    >
      <View style={[styles.hero, { backgroundColor: colors.sand }]}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <Txt v="h1" color={colors.onSurfaceInverse}>
          Arma un kit a tu modo.
        </Txt>
        <Txt v="caption" color={colors.onSurfaceInverse} style={{ marginTop: 4 }}>
          Elige el momento, el tamaño y lo que te acompaña.
        </Txt>
        <Btn label="Armar nuevo kit" variant="accent" icon="package-plus" small onPress={() => router.push("/kit-builder")} testID="kits-new-button" style={{ alignSelf: "flex-start", marginTop: space.lg }} />
      </View>

      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
        {links.map((l) => (
          <Pressable key={l.label} onPress={() => router.push(l.href as any)} testID={`kits-link-${l.label}`} style={({ pressed }) => [styles.link, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.8 : 1 }]}>
            <Ic name={l.icon} size={20} />
            <Txt v="medium" style={{ fontSize: 13 }}>
              {l.label}
            </Txt>
          </Pressable>
        ))}
      </View>

      <Section title="Mis kits" testID="my-kits-section">
        {kits.isLoading ? <Loading /> : (kits.data || []).length === 0 ? (
          <Txt v="caption">Aún no guardas kits. Empieza a crear el tuyo o parte de uno sugerido.</Txt>
        ) : (
          kits.data!.map((k, i) => (
            <Row key={k.id} icon={k.for_name ? "gift" : "package"} tint={k.for_name ? "coral" : "sage"} title={k.name} subtitle={`${k.context || "Sin contexto"} · ${k.items.length} artículos · ${money(k.total)}${k.for_name ? ` · Para ${k.for_name}` : ""}`} onPress={() => router.push(`/kit/${k.id}`)} testID={`my-kit-${k.id}`} last={i === kits.data!.length - 1} />
          ))
        )}
      </Section>

      <Section title="Kits sugeridos" testID="suggested-kits-section">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
          {(sugg.data || []).map((k) => (
            <Pressable key={k.id} onPress={() => router.push(`/kit/${k.id}`)} testID={`suggested-kit-${k.id}`} style={{ width: 200 }}>
              <View style={styles.collage}>
                {k.items.slice(0, 4).map((it: any) => (
                  <ProductImage key={it.product_id} product={it.product} height={78} style={{ width: "48%" }} />
                ))}
              </View>
              <Txt v="title" style={{ marginTop: space.sm }} numberOfLines={1}>
                {k.name}
              </Txt>
              <Txt v="caption" numberOfLines={2}>
                {k.description}
              </Txt>
              <Txt v="medium" style={{ marginTop: 2, fontSize: 14 }}>
                {money(k.total)}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      </Section>

      <Section title="Sugerencias para ti" action="Catálogo" onAction={() => router.push("/catalog")} testID="for-you-section">
        {!forYou.data?.based_on ? (
          <Txt v="caption" style={{ marginBottom: space.md }}>
            Cuéntanos tus gustos en Perfil para sugerencias más tuyas.
          </Txt>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
          {(forYou.data?.products || []).map((p: any) => (
            <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} testID={`for-you-${p.id}`} style={{ width: 140 }}>
              <ProductImage product={p} height={140} />
              <Txt v="medium" style={{ marginTop: space.sm, fontSize: 14 }} numberOfLines={2}>
                {p.name}
              </Txt>
              <Txt v="caption">{money(p.price)}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      </Section>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space.xl, overflow: "hidden", marginTop: space.sm, minHeight: 190, justifyContent: "flex-end" },
  link: { flex: 1, borderRadius: radius.md, paddingVertical: space.lg, alignItems: "center", gap: space.sm },
  collage: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "space-between" },
});
