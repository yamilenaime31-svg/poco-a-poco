import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Card, Field, Ic, Section, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const SHIP = [
  { label: "Estándar", text: "3 a 5 días hábiles dentro de México" },
  { label: "Recoger en punto AMODO", text: "Te avisamos cuando esté listo" },
];

function Line({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm, paddingVertical: 4 }}>
      <Txt v={bold ? "title" : "caption"} style={{ flex: 1 }}>{l}</Txt>
      <Txt v={bold ? "title" : "caption"}>{r}</Txt>
    </View>
  );
}

export default function Checkout() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const cart = useApi<any>("/cart");
  const [f, setF] = useState({ recipient: user?.name || "", phone: "", street: "", city: "", zip: "", notes: "", gift_note: "" });
  const [ship, setShip] = useState("Estándar");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const q = useApi<any>(`/checkout/quote?shipping=${encodeURIComponent(ship)}`);
  const b = q.data;

  const pay = async () => {
    const e: Record<string, string> = {};
    if (!f.recipient.trim()) e.recipient = "¿Quién recibe?";
    if (f.phone.replace(/\D/g, "").length < 7) e.phone = "Escribe un teléfono de contacto.";
    if (f.street.trim().length < 3) e.street = "Escribe la calle y número.";
    if (f.city.trim().length < 2) e.city = "Escribe la ciudad.";
    if (!/^\d{5}$/.test(f.zip.trim())) e.zip = "Por ahora solo enviamos dentro de México: escribe un código postal de 5 dígitos.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const o = await api("/orders/checkout", { method: "POST", body: { ...f, shipping: ship } });
      invalidate();
      router.replace({ pathname: "/order/[id]", params: { id: o.id, new: "1" } });
    } catch (err: any) {
      toast.show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Checkout"
      testID="checkout-screen"
      footer={
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt v="medium">Total</Txt>
            <Txt v="h2" testID="checkout-total">
              {b ? money(b.total) : "…"}
            </Txt>
          </View>
          <Btn label="Confirmar pedido" icon="lock" loading={busy} disabled={!cart.data?.items?.length} onPress={pay} testID="checkout-confirm-button" />
        </>
      }
    >
      <Txt v="label">Entrega</Txt>
      <View style={{ height: space.md }} />
      <Field label="Nombre de quien recibe" value={f.recipient} onChangeText={set("recipient")} error={errors.recipient} testID="checkout-recipient-input" />
      <Field label="Teléfono" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} testID="checkout-phone-input" />
      <Field label="Calle y número" value={f.street} onChangeText={set("street")} error={errors.street} testID="checkout-street-input" />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 2 }}>
          <Field label="Ciudad" value={f.city} onChangeText={set("city")} error={errors.city} testID="checkout-city-input" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="C.P." value={f.zip} onChangeText={set("zip")} keyboardType="number-pad" maxLength={6} error={errors.zip} testID="checkout-zip-input" />
        </View>
      </View>
      <Field label="Indicaciones de entrega (opcional)" value={f.notes} onChangeText={set("notes")} testID="checkout-notes-input" />
      <Field label="Mensaje de regalo (opcional)" value={f.gift_note} onChangeText={set("gift_note")} multiline testID="checkout-gift-input" />

      <Section title="Envío">
        {SHIP.map((s) => (
          <Pressable key={s.label} onPress={() => setShip(s.label)} testID={`checkout-ship-${s.label}`} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1.5, marginBottom: space.sm, borderColor: ship === s.label ? colors.onSurface : colors.border, backgroundColor: colors.surfaceSecondary }}>
            <Ic name={ship === s.label ? "circle-check" : "circle"} size={20} />
            <View style={{ flex: 1 }}>
              <Txt v="medium">{s.label}</Txt>
              <Txt v="caption">{s.text}</Txt>
            </View>
            <Txt v="medium">Incluido</Txt>
          </Pressable>
        ))}
        <Txt v="caption">El envío estándar ya está incluido en el precio de tus kits. Por ahora la cobertura es dentro de México.</Txt>
      </Section>

      <Section title="Pago">
        <Card tint="lavender" testID="checkout-simulated-notice">
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <Ic name="credit-card" size={20} />
            <Txt v="title">Pedido de demostración</Txt>
          </View>
          <Txt style={{ marginTop: space.sm }}>No se procesa ningún pago. Tu pedido queda «Pendiente de confirmación» y podrás seguir su estado o cancelarlo.</Txt>
        </Card>
      </Section>

      <Section title="Resumen">
        {(cart.data?.items || []).map((i: any) => (
          <View key={i.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <Txt v="caption" style={{ flex: 1 }} numberOfLines={1}>
              {i.qty} × {i.name}
            </Txt>
            <Txt v="caption">{money(i.subtotal)}</Txt>
          </View>
        ))}
        {b ? (
          <View testID="checkout-breakdown">
            {b.discounts.map((d: any) => <Line key={d.label} l={d.label} r={`−${money(d.amount)}`} />)}
            {b.credit ? <Line l={`Crédito disponible (${money(b.credit_available)})`} r={`−${money(b.credit)}`} /> : null}
            <Line l="Envío estándar" r="Incluido" />
            <Line l="Total" r={money(b.total)} bold />
            <Txt v="caption" style={{ marginTop: space.sm }}>Plan: {b.plan}. {b.rule} {b.tax_note} Sin cargos adicionales.</Txt>
          </View>
        ) : null}
      </Section>
    </Screen>
  );
}
