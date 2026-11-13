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
  { label: "Estándar", cost: 99, text: "3 a 5 días hábiles" },
  { label: "Express", cost: 179, text: "1 a 2 días hábiles" },
  { label: "Recoger en punto AMODO", cost: 0, text: "Te avisamos cuando esté listo" },
];

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
  const cost = SHIP.find((s) => s.label === ship)!.cost;
  const subtotal = cart.data?.subtotal || 0;

  const pay = async () => {
    const e: Record<string, string> = {};
    if (!f.recipient.trim()) e.recipient = "¿Quién recibe?";
    if (f.phone.replace(/\D/g, "").length < 7) e.phone = "Escribe un teléfono de contacto.";
    if (f.street.trim().length < 3) e.street = "Escribe la calle y número.";
    if (f.city.trim().length < 2) e.city = "Escribe la ciudad.";
    if (!/^\d{4,6}$/.test(f.zip.trim())) e.zip = "Código postal no válido.";
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
              {money(subtotal + cost)}
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
            <Txt v="medium">{s.cost ? money(s.cost) : "Gratis"}</Txt>
          </Pressable>
        ))}
      </Section>

      <Section title="Pago">
        <Card tint="lavender" testID="checkout-simulated-notice">
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <Ic name="credit-card" size={20} />
            <Txt v="title">Pago simulado</Txt>
          </View>
          <Txt style={{ marginTop: space.sm }}>Esta versión no realiza ningún cargo real. Tu pedido se crea y podrás seguir su estado.</Txt>
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <Txt v="caption">Envío</Txt>
          <Txt v="caption">{cost ? money(cost) : "Gratis"}</Txt>
        </View>
      </Section>
    </Screen>
  );
}
