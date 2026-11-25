import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Field, Ic, ProductImage, Screen, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

function Line({ l, r, strong, testID }: { l: string; r: string; strong?: boolean; testID?: string }) {
  return (
    <View style={styles.line} testID={testID}>
      <Txt v={strong ? "title" : "caption"} color={strong ? undefined : undefined} style={{ flex: 1 }}>{l}</Txt>
      <Txt v={strong ? "h2" : "medium"} style={!strong ? { fontSize: 14 } : undefined}>{r}</Txt>
    </View>
  );
}

type CreditMode = "all" | "none" | "custom";

export default function Checkout() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [f, setF] = useState({ recipient: user?.name || "", phone: "", street: "", city: "", zip: "", notes: "", gift_note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<CreditMode>("all");
  const [custom, setCustom] = useState("");
  const requestId = useRef(`co-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const credit = mode === "all" ? undefined : mode === "none" ? 0 : Number(custom.replace(",", ".")) || 0;
  const q = useApi<any>(`/checkout/quote${credit === undefined ? "" : `?use_credit=${credit}`}`);
  const b = q.data;
  const items: any[] = b?.items || [];

  const confirm = async () => {
    if (busy) return;
    const e: Record<string, string> = {};
    if (!f.recipient.trim()) e.recipient = "¿Quién recibe?";
    if (f.phone.replace(/\D/g, "").length < 7) e.phone = "Escribe un teléfono de contacto.";
    if (f.street.trim().length < 3) e.street = "Escribe la calle y número.";
    if (f.city.trim().length < 2) e.city = "Escribe la ciudad.";
    if (!/^\d{5}$/.test(f.zip.trim())) e.zip = "Escribe un código postal de 5 dígitos.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.show("Revisa la dirección de entrega: faltan algunos datos.", "error");
      return;
    }
    setBusy(true);
    try {
      const o = await api("/orders/checkout", { method: "POST", body: { ...f, shipping: "Estándar", use_credit: b?.credit ?? 0, request_id: requestId.current } });
      invalidate();
      router.replace({ pathname: "/order-confirmed", params: { id: o.id } });
    } catch (err: any) {
      toast.show(err.message, "error");
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Resumen del pedido"
      testID="checkout-screen"
      footer={
        <>
          <View style={styles.line}>
            <Txt v="medium">Total · envío incluido</Txt>
            <Txt v="h2" testID="checkout-total">{b ? money(b.total) : "…"}</Txt>
          </View>
          <Btn label="Confirmar pedido" loading={busy} disabled={!items.length || busy} onPress={confirm} testID="checkout-confirm-button" />
          <Txt v="caption" style={{ textAlign: "center" }} testID="checkout-demo-note">Pedido de demostración. No se realizará ningún cobro real.</Txt>
        </>
      }
    >
      {items.map((it) => (
        <View key={it.id} style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID={`checkout-item-${it.id}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Txt v="title" numberOfLines={2}>{it.qty > 1 ? `${it.qty} × ` : ""}{it.name}</Txt>
              <Txt v="caption">{it.type === "kit" ? it.size_label : "Artículo suelto"}</Txt>
            </View>
            <Txt v="medium">{money(it.subtotal)}</Txt>
          </View>
          {it.images?.length ? (
            <View style={styles.imgs}>
              {it.images.map((p: any, i: number) => <ProductImage key={i} product={p} height={48} style={{ width: 48 }} />)}
            </View>
          ) : null}
          {it.type === "kit" ? (
            <>
              <Line l="Precio base (artículos incluidos)" r={money(it.base * it.qty)} />
              <Line l="Suplementos premium" r={money((it.supplements || 0) * it.qty)} />
            </>
          ) : null}
          {it.detail ? <Txt v="caption" numberOfLines={2}>{it.detail}</Txt> : null}
        </View>
      ))}
      {!items.length && !q.isLoading ? <Txt v="caption">Tu carrito está vacío.</Txt> : null}

      {b ? (
        <Section title="Beneficios y créditos" testID="checkout-benefits">
          <Txt v="caption" style={{ marginBottom: space.sm }}>Plan: {b.plan}</Txt>
          {b.discounts.length ? b.discounts.map((d: any) => <Line key={d.label} l={d.label} r={`−${money(d.amount)}`} testID="checkout-discount" />) : <Txt v="caption">Sin descuentos activos.</Txt>}
          {b.credit_available > 0 ? (
            <View style={{ marginTop: space.md }}>
              <Txt v="medium">Tienes {money(b.credit_available)} en créditos</Txt>
              <View style={styles.modes}>
                {([["all", "Usar el máximo"], ["custom", "Elegir monto"], ["none", "Guardarlos"]] as [CreditMode, string][]).map(([k, l]) => (
                  <Pressable key={k} onPress={() => setMode(k)} testID={`checkout-credit-${k}`} style={[styles.mode, { borderColor: mode === k ? colors.onSurface : colors.border, backgroundColor: mode === k ? colors.sageSoft : colors.surfaceSecondary }]}>
                    <Txt v="caption" color={colors.onSurface}>{l}</Txt>
                  </Pressable>
                ))}
              </View>
              {mode === "custom" ? <Field label={`Monto a usar (máximo ${money(b.credit_max)})`} value={custom} onChangeText={setCustom} keyboardType="decimal-pad" testID="checkout-credit-amount" /> : null}
              {b.credit ? <Line l={`Créditos utilizados${b.credit_institution ? " (incluye institucionales)" : ""}`} r={`−${money(b.credit)}`} testID="checkout-credit-line" /> : null}
            </View>
          ) : null}
          <Line l="Envío estándar" r="Incluido" />
          <Line l="Total" r={money(b.total)} strong />
          <Txt v="caption">{b.rule} {b.tax_note}</Txt>
        </Section>
      ) : null}

      <Section title="Dirección de entrega">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Usa una dirección de prueba: no se hará ningún envío real.</Txt>
        <Field label="Nombre de quien recibe" value={f.recipient} onChangeText={set("recipient")} error={errors.recipient} testID="checkout-recipient-input" />
        <Field label="Teléfono" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} testID="checkout-phone-input" />
        <Field label="Calle y número" value={f.street} onChangeText={set("street")} error={errors.street} testID="checkout-street-input" />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 2 }}><Field label="Ciudad" value={f.city} onChangeText={set("city")} error={errors.city} testID="checkout-city-input" /></View>
          <View style={{ flex: 1 }}><Field label="C.P." value={f.zip} onChangeText={set("zip")} keyboardType="number-pad" maxLength={5} error={errors.zip} testID="checkout-zip-input" /></View>
        </View>
        <Field label="Indicaciones de entrega (opcional)" value={f.notes} onChangeText={set("notes")} testID="checkout-notes-input" />
        <Field label="Mensaje de regalo (opcional)" value={f.gift_note} onChangeText={set("gift_note")} multiline testID="checkout-gift-input" />
      </Section>
      <View style={[styles.notice, { backgroundColor: colors.surfaceTertiary }]} testID="checkout-simulated-notice">
        <Ic name="info" size={16} color={colors.muted} />
        <Txt v="caption" style={{ flex: 1 }}>No pedimos datos bancarios. Al confirmar se guarda un pedido de demostración que puedes seguir desde Kits › Pedidos.</Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.sm, paddingVertical: 4 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, gap: 4 },
  imgs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: space.sm },
  modes: { flexDirection: "row", gap: space.sm, marginVertical: space.sm, flexWrap: "wrap" },
  mode: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 1, justifyContent: "center" },
  notice: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.sm, marginTop: space.lg },
});
