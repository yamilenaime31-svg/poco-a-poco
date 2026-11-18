import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { TabScreen } from "@/src/components/tab-screen";
import { TileGrid } from "@/src/components/tile-grid";
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
  const shared = useApi<any[]>(user?.role === "caregiver" ? "/kits-shared" : null);
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
            <Txt v="title" style={{ marginBottom: space.md }} testID="reco-headline">{reco.data?.headline}</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
              {(reco.data?.products || []).map((p: any) => (
                <View key={p.id} style={[styles.reco, { backgroundColor: colors.surfaceSecondary }]} testID={`reco-card-${p.id}`}>
                  <ProductImage product={p} height={120} />
                  <Txt v="caption" style={{ marginTop: space.sm }}>{p.category} · {money(p.price)}</Txt>
                  <Txt v="title" numberOfLines={1}>{p.name}</Txt>
                  <View style={[styles.why, { backgroundColor: colors.lavenderSoft }]}>
                    <Txt v="label" color={colors.onSurface}>¿Por qué?</Txt>
                    <Txt v="caption" color={colors.onSurface} numberOfLines={3} testID={`reco-reason-${p.id}`}>{p.reasons?.[0]}</Txt>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Btn label="Ver" small variant="secondary" onPress={() => router.push(`/product/${p.id}`)} testID={`reco-view-${p.id}`} style={{ flex: 1, paddingHorizontal: 8 }} />
                    <Btn label="A kit" small icon="plus" onPress={() => router.push({ pathname: "/kit-builder", params: { add: p.id } })} testID={`reco-add-${p.id}`} style={{ flex: 1, paddingHorizontal: 8 }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Pressable onPress={() => feedback(p.id, "dismiss", "No te lo mostraremos de nuevo")} testID={`reco-dismiss-${p.id}`} hitSlop={8}><Txt v="caption" style={{ textDecorationLine: "underline" }}>No me interesa</Txt></Pressable>
                    <Pressable onPress={() => feedback(p.id, "owned", "Anotado: ya lo tienes")} testID={`reco-owned-${p.id}`} hitSlop={8}><Txt v="caption" style={{ textDecorationLine: "underline" }}>Ya lo tengo</Txt></Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Txt v="caption" style={{ marginTop: space.lg, marginBottom: space.sm }}>Kits que podrías personalizar</Txt>
            {(reco.data?.kits || []).slice(0, 3).map((k: any, i: number) => (
              <Row key={k.id} icon="package" tint={["sage", "lavender", "coral"][i]} title={k.name} subtitle={`${k.reason} · ${money(k.total)}`} onPress={() => router.push(`/kit/${k.id}`)} testID={`reco-kit-${k.id}`} last={i === 2} />
            ))}
            <Pressable onPress={() => feedback("", "reset", "Volvimos a mostrar todas las sugerencias")} testID="reco-reset" style={{ marginTop: space.sm }}><Txt v="caption" style={{ textDecorationLine: "underline" }}>Ver otras opciones de nuevo</Txt></Pressable>
          </>
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
        <Section title="Compartidos conmigo">
          {shared.data!.map((k) => <Row key={k.id} icon="users" tint="lavender" title={k.name} subtitle={`De ${k.owner_name} · ${k.items.length} artículos`} onPress={() => router.push(`/kit/${k.id}`)} testID={`shared-kit-${k.id}`} />)}
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
  reco: { width: 240, borderRadius: radius.lg, padding: space.md },
  why: { borderRadius: radius.sm, padding: space.sm, marginVertical: space.sm, minHeight: 64 },
});
