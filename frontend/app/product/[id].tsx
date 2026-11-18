import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { DEMO_PRICE, KIT_SIZES, money } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Badge, Btn, ErrorState, Field, IconBtn, Loading, ProductImage, Row, Screen, Sheet, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const q = useApi<any>(`/products/${id}`);
  const favs = useApi<any[]>(user ? "/favorites" : null);
  const kits = useApi<any[]>(user ? "/kits" : null);
  const [color, setColor] = useState("");
  const [text, setText] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [kitSheet, setKitSheet] = useState(false);
  const p = q.data;
  const fav = (favs.data || []).some((f) => f.id === id);
  const options = { ...(color ? { color } : {}), ...(text.trim() ? { text: text.trim() } : {}) };

  const needUser = () => {
    if (!user) {
      router.push("/welcome");
      return true;
    }
    return false;
  };

  const addCart = async () => {
    if (needUser()) return;
    setBusy(true);
    try {
      await api("/cart", { method: "POST", body: { type: "product", ref_id: id, qty, options } });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      invalidate();
      toast.show("Agregado al carrito");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const addToKit = async (k: any) => {
    const max = KIT_SIZES.find((s) => s.label === k.size)?.max || 7;
    if (k.items.length >= max) return toast.show(`El kit ${k.name} ya está completo (${max} artículos)`, "error");
    try {
      await api(`/kits/${k.id}`, { method: "PUT", body: { ...k, items: [...k.items.map((i: any) => ({ product_id: i.product_id, options: i.options })), { product_id: id, options }] } });
      invalidate();
      setKitSheet(false);
      toast.show(`Agregado a ${k.name}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const toggleFav = async () => {
    if (needUser()) return;
    await api(`/favorites/${id}`, { method: "POST" });
    invalidate();
  };

  return (
    <Screen
      title=""
      testID="product-detail-screen"
      right={<IconBtn icon="heart" onPress={toggleFav} testID="product-fav-button" badge={fav} />}
      footer={
        p ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Btn label="Agregar a un kit" variant="secondary" icon="package-plus" onPress={() => !needUser() && setKitSheet(true)} testID="product-add-kit-button" style={{ flex: 1 }} />
            <Btn label="Al carrito" icon="shopping-bag" loading={busy} onPress={addCart} testID="product-add-cart-button" style={{ flex: 1 }} />
          </View>
        ) : null
      }
      overlay={
        <Sheet visible={kitSheet} onClose={() => setKitSheet(false)} title="Elegir kit" testID="product-kit-sheet">
          {(kits.data || []).length === 0 ? <Txt v="caption">Aún no tienes kits guardados.</Txt> : kits.data!.map((k) => <Row key={k.id} icon="package" title={k.name} subtitle={`${k.items.length} artículos · ${k.size}`} onPress={() => addToKit(k)} testID={`product-kit-option-${k.id}`} />)}
          <Btn label="Armar un kit nuevo" variant="secondary" small onPress={() => { setKitSheet(false); router.push("/kit-builder"); }} testID="product-new-kit-button" style={{ marginTop: space.lg }} />
        </Sheet>
      }
    >
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <ProductImage product={p} height={300} />
          <Badge label={p.category} tint="sage" />
          <Txt v="h1" style={{ marginTop: space.md }} testID="product-name">
            {p.name}
          </Txt>
          <Txt v="h2" style={{ marginTop: space.xs }} testID="product-price">
            {money(p.price)} <Txt v="caption">· {DEMO_PRICE}</Txt>
          </Txt>
          <Txt style={{ marginTop: space.md, marginBottom: space.xl }}>{p.description}</Txt>
          {p.colors?.length || p.personalize_text ? (
            <>
              <Txt v="label" style={{ marginBottom: space.md }}>
                Personalizar
              </Txt>
              {p.colors?.length ? <SingleChoice label="Color" options={p.colors} value={color} onChange={setColor} testID="product-color" /> : null}
              {p.personalize_text ? <Field label="Iniciales o mensaje corto" value={text} onChangeText={setText} maxLength={24} hint="Hasta 24 caracteres" testID="product-text-input" /> : null}
            </>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Txt v="medium">Cantidad</Txt>
            <IconBtn icon="minus" onPress={() => setQty(Math.max(1, qty - 1))} testID="product-qty-minus" />
            <Txt v="title" testID="product-qty">
              {qty}
            </Txt>
            <IconBtn icon="plus" onPress={() => setQty(qty + 1)} testID="product-qty-plus" />
          </View>
          <Txt v="caption" color={colors.muted} style={{ marginTop: space.xl }}>
            Fotografía del producto próximamente.
          </Txt>
        </>
      )}
    </Screen>
  );
}
