import { useAuth } from "@/src/auth";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDate, fmtDateTime, freeFeatures, money, plusFeatures } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Ic, Loading, Row, Screen, Section, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const KIND: Record<string, string> = { plus_access: "Acceso Plus", kit_discount_pct: "Descuento en kits", credit: "Crédito para artículos" };

/** Mi plan y beneficios + comparison Free vs Plus (demo activation, no charge). */
export default function Plan() {
  const { user } = useAuth();
  const FREE = freeFeatures(user?.role);
  const PLUS = plusFeatures(user?.role);
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useApi<any>("/me/plan");
  const [confirm, setConfirm] = useState<"plus" | "free" | null>(null);
  const [busy, setBusy] = useState(false);
  const p = q.data;
  const wallet = useApi<any>("/wallet").data;
  const ai = useApi<any>("/me/ai-usage").data;

  const change = async () => {
    setBusy(true);
    try {
      await api("/me/plan", { method: "POST", body: { action: confirm } });
      invalidate();
      toast.show("Cancelaste Plus. Tus créditos se conservan.");
      setConfirm(null);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!p) return <Screen title="Mi plan y beneficios"><Loading /></Screen>;
  const isPlus = p.tier === "plus";
  return (
    <Screen title="Mi plan y beneficios" testID="plan-screen">
      <Card tint="sage" testID="plan-current">
        <Txt v="label">Plan actual</Txt>
        <Txt v="h2" testID="plan-name">{p.name}</Txt>
        <Txt v="caption" color={colors.onSurface}>{p.until ? `Vigente hasta ${fmtDate(p.until)}${p.source ? ` · ${p.source}` : ""}` : "Sin vencimiento"}</Txt>
      </Card>

      {isPlus && p.subscription ? (
        <Section title="Membresía" testID="plan-subscription">
          <Row icon="calendar-check" tint="sand" title={`${money(p.subscription.price)} al mes`} subtitle={`Próxima renovación: ${fmtDate(p.until)} · demostración, sin cobro`} />
        </Section>
      ) : null}
      <Section title="Créditos y asistente">
        <Row icon="wallet" tint="sand" title="Mis créditos" subtitle={wallet ? `${money(wallet.available)} disponibles` : ""} onPress={() => router.push("/credits")} testID="plan-credits-link" />
        {ai ? <Row icon="wand-sparkles" tint="sand" title="Uso del asistente este mes" subtitle={`${ai.used} de ${ai.limit} interacciones`} testID="plan-ai-usage" last /> : null}
      </Section>
      <Section title="Beneficios activos">
        {p.benefits.length ? p.benefits.map((b: any, i: number) => (
          <Row key={b.id} icon="gift" tint="lavender" title={KIND[b.kind]} last={i === p.benefits.length - 1} testID={`plan-benefit-${b.kind}`}
            subtitle={[b.kind === "credit" ? `${money(b.remaining)} de ${money(b.value)} disponibles` : b.kind === "kit_discount_pct" ? `${b.value}%` : `${b.value} mes(es)`, b.institution, `hasta ${fmtDate(b.until)}`].join(" · ")} />
        )) : <Txt v="caption">Aún no tienes beneficios adicionales. Todas las funciones esenciales de apoyo son gratuitas.</Txt>}
        <Btn label="Tengo un código de institución" icon="ticket" variant="secondary" onPress={() => router.push("/redeem")} testID="plan-redeem-button" style={{ marginTop: space.md }} />
      </Section>

      <Section title="Compara planes">
        <View style={styles.cols}>
          {[{ k: "free", t: "Gratis", price: "$0", list: FREE }, { k: "plus", t: "Plus", price: `${money(p.prices.plus_price)} al mes`, list: PLUS }].map((c) => {
            const on = (c.k === "plus") === isPlus;
            return (
              <View key={c.k} style={[styles.col, { backgroundColor: colors.surfaceSecondary, borderColor: on ? colors.onSurface : colors.border }]} testID={`plan-col-${c.k}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                  <Txt v="title">{c.t}</Txt>
                  {on ? <Badge label="Actual" tint="sage" /> : null}
                </View>
                <Txt v="medium" style={{ fontSize: 14 }}>{c.price}</Txt>
                {c.list.map((x) => (
                  <View key={x} style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    <Ic name="check" size={14} />
                    <Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{x}</Txt>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        <Txt v="caption" style={{ marginTop: space.md }}>Plus es opcional: no mejora ningún tratamiento ni restringe la información de seguridad. Los kits se compran por separado. Precio ilustrativo; en este prototipo Plus se activa sin cobro y puedes cancelarlo cuando quieras.</Txt>
        {p.source !== "Institucional" ? (
          <Btn label={isPlus ? "Cancelar membresía" : "Conocer AMODO Plus"} variant={isPlus ? "ghost" : "primary"} onPress={() => (isPlus ? setConfirm("free") : router.push("/plus"))} testID="plan-change-button" style={{ marginTop: space.md }} />
        ) : null}
      </Section>

      <Section title="Historial de beneficios">
        {p.history.length ? p.history.map((h: any, i: number) => <Row key={h.id} icon="history" tint="sand" title={h.text} subtitle={fmtDateTime(h.at)} last={i === p.history.length - 1} />) : <Txt v="caption">Sin movimientos todavía.</Txt>}
      </Section>

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title={confirm === "plus" ? "¿Activar AMODO Plus?" : "¿Cancelar AMODO Plus?"} testID="plan-confirm-sheet">
        <Txt style={{ marginBottom: space.lg }}>{confirm === "plus" ? "Es una activación de demostración por 30 días, sin ningún cargo. Puedes cancelarla cuando quieras." : "Sigues con AMODO Gratis. Conservas toda tu información y los créditos que ya recibiste."}</Txt>
        <Btn label="Confirmar" loading={busy} onPress={change} testID="plan-confirm-button" />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: "row", gap: space.sm },
  col: { flex: 1, minWidth: 0, borderRadius: radius.md, borderWidth: 1.5, padding: space.md },
});
