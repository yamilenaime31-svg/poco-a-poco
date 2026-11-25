import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDateTime, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, ErrorState, Ic, Loading, Screen, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useApi<any>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [fav, setFav] = useState(false);
  const o = q.data;

  const cancel = async () => {
    setBusy(true);
    try {
      await api(`/orders/${id}/cancel`, { method: "POST" });
      invalidate();
      toast.show("Pedido cancelado");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Seguimiento de pedido" testID="order-detail-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt v="h1" testID="order-number">
              {o.number}
            </Txt>
            <Badge label={o.status} tint={o.status === "Cancelado" ? "sand" : "sage"} testID="order-status" />
          </View>
          <Txt v="caption">{fmtDateTime(o.created_at)}</Txt>
          {o.status === "Cancelado" ? <Txt v="caption" style={{ marginTop: space.md }} testID="order-cancelled-note">Este pedido se canceló. Los créditos usados se devolvieron a tu saldo.</Txt> : null}
          <Section title="Seguimiento">
            {o.timeline.map((s: any, i: number) => (
              <View key={s.label} style={{ flexDirection: "row", gap: space.md }} testID={`order-step-${i}`}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: s.done ? colors.sage : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                    {s.done ? <Ic name="check" size={14} color={colors.onBrandPrimary} /> : null}
                  </View>
                  {i < o.timeline.length - 1 ? <View style={{ width: 2, height: 30, backgroundColor: s.done ? colors.sage : colors.surfaceTertiary }} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 4 }}>
                  <Txt v={s.done ? "medium" : "body"} color={s.done ? colors.onSurface : colors.muted} style={{ marginTop: 1 }}>{s.label}</Txt>
                  {s.at ? <Txt v="caption">{fmtDateTime(s.at)}</Txt> : null}
                </View>
              </View>
            ))}
          </Section>
          <Section title="Artículos">
            {o.items.map((i: any, k: number) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.divider }}>
                <View style={{ flex: 1 }}>
                  <Txt v="medium">
                    {i.qty} × {i.name}
                  </Txt>
                  {i.detail ? <Txt v="caption">{i.detail}</Txt> : null}
                </View>
                <Txt v="medium">{money(i.subtotal)}</Txt>
              </View>
            ))}
            {(o.discounts || []).map((d: any) => (
              <View key={d.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space.sm }}>
                <Txt v="caption" style={{ flex: 1 }}>{d.label}</Txt>
                <Txt v="caption">−{money(d.amount)}</Txt>
              </View>
            ))}
            {o.credit ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space.sm }}>
                <Txt v="caption">{o.credit_plus && o.credit_institution ? "Créditos Plus e institucionales" : o.credit_plus ? "Créditos AMODO" : "Crédito institucional"}</Txt>
                <Txt v="caption">−{money(o.credit)}</Txt>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space.md }}>
              <Txt v="caption">Envío estándar</Txt>
              <Txt v="caption">Incluido</Txt>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space.sm }}>
              <Txt v="title">Total</Txt>
              <Txt v="title" testID="order-total">
                {money(o.total)}
              </Txt>
            </View>
          </Section>
          <Section title="Entrega y pago">
            <Txt>{o.address.recipient} · {o.address.phone}</Txt>
            <Txt v="caption">
              {o.address.street}, {o.address.city}, C.P. {o.address.zip}
            </Txt>
            {o.address.gift_note ? <Txt v="caption" style={{ marginTop: space.sm }}>Mensaje: “{o.address.gift_note}”</Txt> : null}
            <Txt v="caption" style={{ marginTop: space.sm }}>
              {o.payment.method} · {o.payment.status}
            </Txt>
          </Section>
          {o.cancellable ? <Btn label="Cancelar pedido" variant="ghost" loading={busy} onPress={cancel} testID="order-cancel-button" style={{ marginTop: space.xl }} /> : null}
          <Btn label="Volver a pedir" variant="secondary" icon="repeat" onPress={async () => { await api(`/orders/${id}/repeat`, { method: "POST" }); invalidate(); router.push("/cart"); }} testID="order-repeat-button" style={{ marginTop: space.md }} />
          <Btn label={o.favorite ? "Guardado en favoritos" : "Guardar como favorito"} variant="secondary" icon="star" disabled={o.favorite || fav} onPress={async () => { setFav(true); try { await api(`/orders/${id}/favorite`, { method: "POST" }); invalidate(); toast.show("Guardado en Mis kits como favorito"); } catch (e: any) { setFav(false); toast.show(e.message, "error"); } }} testID="order-favorite-button" style={{ marginTop: space.md }} />
          <Btn label="Ver mis pedidos" variant="secondary" onPress={() => router.replace("/orders")} testID="order-all-button" style={{ marginTop: space.md }} />
        </>
      )}
    </Screen>
  );
}
