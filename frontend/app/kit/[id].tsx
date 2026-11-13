import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, ErrorState, Loading, ProductImage, Row, Screen, Sheet, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function KitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useApi<any>(`/kits/${id}`);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const k = q.data;

  const addCart = async () => {
    setBusy(true);
    try {
      await api("/cart", { method: "POST", body: { type: "kit", ref_id: id, qty: 1 } });
      invalidate();
      toast.show("Kit agregado al carrito");
      router.push("/cart");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    await api(`/kits/${id}`, { method: "DELETE" });
    invalidate();
    setConfirm(false);
    toast.show("Kit eliminado");
    router.back();
  };

  return (
    <Screen
      title={k?.template ? "Kit sugerido" : "Mi kit"}
      testID="kit-detail-screen"
      footer={
        k ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {k.template ? (
              <Btn label="Personalizar" variant="secondary" icon="sliders-horizontal" onPress={() => router.push({ pathname: "/kit-builder", params: { template: id } })} testID="kit-customize-button" style={{ flex: 1 }} />
            ) : (
              <Btn label="Editar" variant="secondary" icon="pencil" onPress={() => router.push({ pathname: "/kit-builder", params: { id } })} testID="kit-edit-button" style={{ flex: 1 }} />
            )}
            <Btn label="Al carrito" icon="shopping-bag" loading={busy} onPress={addCart} testID="kit-add-cart-button" style={{ flex: 1 }} />
          </View>
        ) : null
      }
      overlay={
        <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Eliminar este kit?" testID="kit-delete-sheet">
          <Txt style={{ marginBottom: space.xl }}>Los pedidos ya hechos no se verán afectados.</Txt>
          <Btn label="Sí, eliminar" variant="danger" onPress={remove} testID="kit-delete-confirm-button" />
        </Sheet>
      }
    >
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <Card style={{ backgroundColor: colors.sand }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {k.items.map((i: any) => (
                <ProductImage key={i.product_id} product={i.product} height={72} style={{ width: 72 }} />
              ))}
            </View>
          </Card>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xl }}>
            <Badge label={k.context || "Kit"} tint="sage" />
            <Badge label={k.size} tint="lavender" />
            {k.for_name ? <Badge label={`Para ${k.for_name}`} tint="coral" /> : null}
          </View>
          <Txt v="h1" style={{ marginTop: space.md }} testID="kit-name">
            {k.name}
          </Txt>
          {k.description || k.note ? <Txt style={{ marginTop: space.sm }}>{k.description || k.note}</Txt> : null}
          <Txt v="label" style={{ marginTop: space.xl }}>
            {k.items.length} artículos
          </Txt>
          {k.items.map((i: any, idx: number) => (
            <Row key={i.product_id + idx} title={i.product.name} subtitle={[i.product.category, i.options?.color, i.options?.text ? `“${i.options.text}”` : null].filter(Boolean).join(" · ")} right={<Txt v="medium">{money(i.product.price)}</Txt>} onPress={() => router.push(`/product/${i.product_id}`)} testID={`kit-item-${i.product_id}`} last={idx === k.items.length - 1} />
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space.lg, marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.onSurface }}>
            <Txt v="caption">Incluye base {money(k.base_price)}</Txt>
            <Txt v="h2" testID="kit-detail-total">
              {money(k.total)}
            </Txt>
          </View>
          {!k.template ? <Btn label="Eliminar kit" variant="ghost" icon="trash-2" onPress={() => setConfirm(true)} testID="kit-delete-button" style={{ marginTop: space.xl }} /> : null}
        </>
      )}
    </Screen>
  );
}
