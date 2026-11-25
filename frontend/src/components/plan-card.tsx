import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { Shape } from "@/src/art";
import { fmtDate, money } from "@/src/constants";
import { Btn, Ic, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const credits = (p: any) => p.benefits.filter((b: any) => b.kind === "credit").reduce((a: number, b: any) => a + (b.remaining || 0), 0);
const discount = (p: any) => Math.max(0, ...p.benefits.filter((b: any) => b.kind === "kit_discount_pct").map((b: any) => b.value));

/** "Mi plan AMODO": large profile card that states the active access (Gratis / Plus / Institucional) and its actions. */
export function PlanCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>("/me/plan");
  const p = q.data;
  const wallet = useApi<any>("/wallet").data;
  const ai = useApi<any>("/me/ai-usage").data;
  if (!p) return null;
  const inst = p.access === "institutional";
  const title = inst ? (p.plus_by_institution ? "AMODO Plus — proporcionado por tu institución" : "Acceso institucional") : p.name;
  const sub = inst ? `Tu acceso es proporcionado por ${p.institution}` : p.tier === "plus" ? "Membresía activa (demostración, sin cobro)" : "Estás utilizando la versión gratuita";
  const facts = [
    p.tier === "plus" && !inst ? `${money(p.subscription?.price ?? p.prices.plus_price)} al mes · demostración` : null,
    p.until ? `${p.tier === "plus" && !inst ? "Se renueva" : "Vigente hasta"} el ${fmtDate(p.until)}` : null,
    wallet?.available ? `Créditos disponibles: ${money(wallet.available)}` : credits(p) ? `Créditos para kits: ${money(credits(p))}` : null,
    p.tier !== "plus" && ai ? `Asistente: ${ai.used} de ${ai.limit} interacciones este mes` : null,
    discount(p) ? `Descuento en kits: ${discount(p)}%` : p.tier === "plus" ? `Descuento Plus en kits: ${p.prices.plus_kit_discount_pct}%` : null,
  ].filter(Boolean) as string[];
  const go = (h: string) => () => router.push(h as any);
  return (
    <View style={[styles.card, { backgroundColor: p.tier === "plus" ? colors.lavender : colors.surfaceSecondary }]} testID="profile-plan-card">
      <View style={{ position: "absolute", right: -18, top: -18 }} pointerEvents="none"><Shape name="burst" size={92} color={p.tier === "plus" ? colors.butter : colors.lavender} /></View>
      <Txt v="label" color={colors.onSurface}>Mi plan AMODO</Txt>
      <Txt v="section" style={{ marginTop: 4, marginRight: 64 }} testID="profile-plan-name">{title}</Txt>
      <Txt v="caption" color={colors.onSurface} testID="profile-plan-sub">{sub}</Txt>
      {facts.map((f) => (
        <View key={f} style={styles.li}><Ic name="check" size={14} /><Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{f}</Txt></View>
      ))}
      <View style={styles.btns}>
        <Btn label="Ver mis beneficios" small onPress={go("/benefits")} testID="plan-card-benefits" style={styles.btn} />
        <Btn label="Mis créditos" small variant="secondary" onPress={go("/credits")} testID="plan-card-credits" style={styles.btn} />
        {inst ? (
          <>
            <Btn label="Mi institución" small variant="secondary" onPress={go("/benefits")} testID="plan-card-institution" style={styles.btn} />
            <Btn label="Ingresar otro código" small variant="ghost" onPress={go("/redeem")} testID="plan-card-code" style={styles.btn} />
          </>
        ) : p.tier === "plus" ? (
          <>
            <Btn label="Administrar membresía" small variant="secondary" onPress={go("/plan")} testID="plan-card-manage" style={styles.btn} />
            <Btn label="Consultar descuentos" small variant="ghost" onPress={go("/benefits")} testID="plan-card-discounts" style={styles.btn} />
          </>
        ) : (
          <>
            <Btn label="Conocer AMODO Plus" small variant="secondary" onPress={go("/plus")} testID="plan-card-plus" style={styles.btn} />
            <Btn label="Comparar planes" small variant="ghost" onPress={go("/plan")} testID="plan-card-compare" style={styles.btn} />
            <Btn label="Tengo un código" small variant="ghost" onPress={go("/redeem")} testID="plan-card-code" style={styles.btn} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: space.lg, marginTop: space.xxl, overflow: "hidden" },
  li: { flexDirection: "row", gap: 6, marginTop: 6 },
  btns: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  btn: { flexGrow: 1, minWidth: 140 },
});
