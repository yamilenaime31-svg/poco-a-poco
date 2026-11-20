import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { TabScreen } from "@/src/components/tab-screen";
import { RecoCard, NeedsPrompt } from "@/src/components/reco-card";
import { TileGrid } from "@/src/components/tile-grid";
import { GuideCard } from "@/src/components/guide-info";
import { CATEGORIES, money, tintOf, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Ic, IconBtn, Loading, ProductImage, Row, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export default function MyKits() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const kits = useApi<any[]>("/kits");
  const favs = useApi<any[]>("/favorites");
  const reco = useApi<any>(`/recommendations?today=${today()}`);
  const again = useApi<any[]>("/reorder");
  const guided = useApi<any>("/guided-kits");
  const shared = useApi<any[]>("/kits-shared");
  const cart = useApi<any>("/cart");

  const feedback = async (id: string, action: string, msg: string) => {
    await api("/recommendations/feedback", { method: "POST", body: { product_id: id, action } });
    invalidate();
    toast.show(msg);
  };

  return (
    <TabScreen title="Mis kits" testID="kits-screen" refreshing={kits.isRefetching} onRefresh={() => invalidate()}
      right={<View style={{ marginRight: space.sm }}><IconBtn icon="shopping-bag" badge={!!cart.data?.count} onPress={() => router.push("/cart")} testID="kits-cart-button" /></View>}>
      <Pressable onPress={() => router.push("/kit-builder")} testID="kits-new-button" style={({ pressed }) => [styles.cta, { backgroundColor: colors.sageSoft, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[styles.ctaIcon, { backgroundColor: colors.surfaceSecondary }]}><Ic name="plus" size={20} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="title">Armar nuevo kit</Txt>
          <Txt v="caption" color={colors.onSurface}>Personalízalo a tu manera</Txt>
        </View>
        <Ic name="arrow-right" size={18} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
        {[{ l: "Catálogo", i: "store", h: "/catalog" }, { l: "Favoritos", i: "heart", h: "/favorites" }, { l: "Pedidos", i: "truck", h: "/orders" }].map((x) => (
          <Pressable key={x.l} accessibilityRole="button" accessibilityLabel={x.l} onPress={() => router.push(x.h as any)} testID={`kits-link-${x.l}`}
            style={({ pressed }) => [styles.quick, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
            <Ic name={x.i} size={18} />
            <Txt v="medium" style={{ fontSize: 13, lineHeight: 17 }} numberOfLines={1}>{x.l}</Txt>
          </Pressable>
        ))}
      </View>

      <Section title="Mis favoritos" action="Ver todos" onAction={() => router.push("/favorites")} testID="kits-favorites">
        {(favs.data || []).length === 0 ? <Txt v="caption">Toca el corazón en un artículo para guardarlo aquí.</Txt> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
            {favs.data!.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} testID={`kits-fav-${p.id}`} style={{ width: 120 }}>
                <ProductImage product={p} height={110} />
                <Txt v="caption" color={colors.onSurface} numberOfLines={2} style={{ marginTop: 6 }}>{p.name}</Txt>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Section>

      <Section title="Recomendados para ti" action="Preferencias" onAction={() => router.push({ pathname: "/onboarding", params: { edit: "1", step: "identity" } })} testID="kits-reco">
        {reco.isLoading ? <Loading /> : (
          <>
            <NeedsPrompt />
            <Txt v="title" style={{ marginBottom: space.md }} testID="reco-headline">{reco.data?.headline}</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
              {(reco.data?.products || []).map((p: any) => <RecoCard key={p.id} p={p} onFeedback={feedback} />)}
            </ScrollView>
            <Txt v="caption" style={{ marginTop: space.lg, marginBottom: space.sm }}>Kits que podrías personalizar</Txt>
            {(reco.data?.kits || []).slice(0, 3).map((k: any, i: number) => (
              <Row key={k.id} icon="package" tint={["sage", "lavender", "coral"][i]} title={k.name} subtitle={`${k.reason} · ${money(k.total)} (ejemplo)`} onPress={() => router.push(`/kit/${k.id}`)} testID={`reco-kit-${k.id}`} last={i === 2} />
            ))}
            <Pressable onPress={() => feedback("", "reset", "Volvimos a mostrar todas las sugerencias")} testID="reco-reset" style={{ marginTop: space.sm }}><Txt v="caption" style={{ textDecorationLine: "underline" }}>Ver otras opciones de nuevo</Txt></Pressable>
          </>
        )}
      </Section>

      <Section title="Según guías confiables" action="Ver todas" onAction={() => router.push("/guides")} testID="kits-guides">
        <Txt v="caption" style={{ marginBottom: space.md }}>Kits de comodidad basados en información general del NCI, la American Cancer Society y MedlinePlus.</Txt>
        {guided.isLoading ? <Loading /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
            {(guided.data?.kits || []).slice(0, 4).map((k: any) => <GuideCard key={k.id} k={k} compact />)}
          </ScrollView>
        )}
      </Section>

      <Section title="Pedir de nuevo" testID="kits-again">
        {(again.data || []).length === 0 && (kits.data || []).length === 0 ? <Txt v="caption">Tus kits guardados y pedidos aparecerán aquí para reutilizarlos. Nunca compramos nada sin tu confirmación.</Txt> : null}
        {(again.data || []).map((k, i) => <Row key={k.ref_id} icon="repeat" tint="butter" title={k.name} subtitle={`${k.detail} · ${money(k.price)}`} onPress={() => router.push(`/kit/${k.ref_id}`)} testID={`again-${k.ref_id}`} />)}
        {(kits.data || []).filter((k) => !(again.data || []).some((a) => a.ref_id === k.id)).map((k, i, arr) => (
          <Row key={k.id} icon={k.for_name ? "gift" : "package"} tint="sage" title={k.name} subtitle={`Guardado · ${k.items.length} artículos · ${money(k.total)}${k.for_name ? ` · Para ${k.for_name}` : ""}`} onPress={() => router.push(`/kit/${k.id}`)} testID={`my-kit-${k.id}`} last={i === arr.length - 1} />
        ))}
      </Section>

      {(shared.data || []).length ? (
        <Section title="Regalos y compartidos" testID="kits-shared">
          {shared.data!.map((k) => <Row key={k.id} icon={k.gift ? "gift" : "users"} tint={k.gift ? "coral" : "lavender"} title={k.name.replace(" · regalo", "")} subtitle={`${k.gift ? "Regalo de" : "De"} ${k.owner_name} · ${k.items.length} artículos${k.thanks ? " · agradecido" : ""}`} onPress={() => router.push(`/kit/${k.id}`)} testID={`shared-kit-${k.id}`} />)}
        </Section>
      ) : null}

      <Section title="Explorar por categoría">
        <TileGrid tiles={CATEGORIES.filter((c) => c.label !== "Detalles").map((c) => ({ key: c.label, label: c.label === "Antojos y preferencias" ? "Antojos" : c.label, icon: c.icon, tint: c.tint, onPress: () => router.push({ pathname: "/catalog", params: { category: c.label } }), testID: `kits-cat-${c.label}` }))} />
      </Section>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  cta: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.lg, marginTop: space.sm },
  ctaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  quick: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 64, paddingVertical: space.sm, paddingHorizontal: 4, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
