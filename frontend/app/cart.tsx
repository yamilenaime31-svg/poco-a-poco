import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { money } from "@/src/constants";
import { Btn, Empty, Ic, IconBtn, Loading, ProductImage, Screen, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function Cart() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>("/cart");
  const c = q.data;
  const setQty = async (id: string, qty: number) => {
    await api(`/cart/${id}`, { method: "PUT", body: { qty } });
    invalidate();
  };
  const remove = async (id: string) => {
    await api(`/cart/${id}`, { method: "DELETE" });
    invalidate();
  };
  return (
    <Screen
      title="Carrito"
      testID="cart-screen"
      footer={
        c?.items?.length ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Txt v="medium">Subtotal</Txt>
              <Txt v="title" testID="cart-subtotal">
                {money(c.subtotal)}
              </Txt>
            </View>
            <Btn label="Continuar al pago" icon="arrow-right" onPress={() => router.push("/checkout")} testID="cart-checkout-button" />
          </>
        ) : null
      }
    >
      {q.isLoading ? <Loading /> : !c?.items?.length ? (
        <Empty icon="shopping-bag" title="Tu carrito está vacío" text="Empieza a crear tu kit o explora artículos sueltos." action="Armar un kit" onAction={() => router.push("/kit-builder")} testID="cart-empty" />
      ) : (
        c.items.map((it: any) => (
          <View key={it.id} style={{ flexDirection: "row", gap: space.md, paddingVertical: space.lg, borderBottomWidth: 0.5, borderBottomColor: colors.divider }} testID={`cart-item-${it.id}`}>
            <ProductImage product={{ category: it.category === "Kit" ? "Detalles" : it.category }} height={72} style={{ width: 72 }} />
            <View style={{ flex: 1 }}>
              <Txt v="medium" numberOfLines={2}>
                {it.name}
              </Txt>
              {it.detail ? <Txt v="caption">{it.detail}</Txt> : null}
              <Txt v="title" style={{ fontSize: 14, marginTop: 2 }}>
                {money(it.subtotal)}
              </Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm }}>
                <IconBtn icon="minus" onPress={() => setQty(it.id, it.qty - 1)} testID={`cart-minus-${it.id}`} />
                <Txt v="title" testID={`cart-qty-${it.id}`}>
                  {it.qty}
                </Txt>
                <IconBtn icon="plus" onPress={() => setQty(it.id, it.qty + 1)} testID={`cart-plus-${it.id}`} />
                <View style={{ flex: 1 }} />
                <IconBtn icon="trash-2" onPress={() => remove(it.id)} testID={`cart-remove-${it.id}`} />
              </View>
            </View>
          </View>
        ))
      )}
      {c?.items?.length ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: space.lg }}>
          <Ic name="truck" size={14} />
          <Txt v="caption">El envío se calcula en el siguiente paso.</Txt>
        </View>
      ) : null}
    </Screen>
  );
}
