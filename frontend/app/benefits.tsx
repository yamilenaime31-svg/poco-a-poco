import { useAuth } from "@/src/auth";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { fmtDate, freeFeatures, money, plusFeatures } from "@/src/constants";
import { Badge, Btn, Card, Ic, Loading, Row, Screen, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const label = (b: any) =>
  b.kind === "plus_access" ? `AMODO Plus por ${b.value} mes(es)` : b.kind === "kit_discount_pct" ? `${b.value}% de descuento en kits` : b.kind === "plus_demo" ? "AMODO Plus (demostración)" : b.label || `Crédito de ${money(b.value)} para artículos`;

/** "Tus beneficios AMODO": only what the account really has; Plus extras are listed separately as available. */
export default function Benefits() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>("/me/plan");
  const p = q.data;
  if (!p) return <Screen title="Tus beneficios AMODO"><Loading /></Screen>;
  const plus = p.tier === "plus";
  const inst = p.benefits.filter((b: any) => b.institution);
  const List = ({ items, icon }: { items: string[]; icon: string }) => (
    <>{items.map((x) => <View key={x} style={{ flexDirection: "row", gap: 6, marginTop: 6 }}><Ic name={icon} size={14} color={colors.muted} /><Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{x}</Txt></View>)}</>
  );
  return (
    <Screen title="Tus beneficios AMODO" testID="benefits-screen">
      <Card tint="sage">
        <Txt v="label">Plan actual</Txt>
        <Txt v="h2" testID="benefits-plan">{p.plus_by_institution ? "AMODO Plus — proporcionado por tu institución" : p.access === "institutional" ? "Acceso institucional" : p.name}</Txt>
        <Txt v="caption" color={colors.onSurface}>{p.until ? `Vigente hasta el ${fmtDate(p.until)}` : p.benefits.length ? `Beneficios vigentes hasta el ${fmtDate(p.benefits.map((b: any) => b.until).sort().pop())}` : "Sin vencimiento"}{p.institution ? ` · ${p.institution}` : ""}</Txt>
      </Card>

      <Section title="Funciones incluidas">
        <List items={plus ? plusFeatures(user?.role) : freeFeatures(user?.role)} icon="check" />
      </Section>

      {!plus ? (
        <Section title="Disponible con AMODO Plus" testID="benefits-plus-available">
          <List items={plusFeatures(user?.role).slice(1)} icon="sparkles" />
          <Txt v="caption" style={{ marginTop: space.sm }}>{money(p.prices.plus_price)}/mes, precio ilustrativo. Activación de demostración sin cobro.</Txt>
          <Btn label="Conocer AMODO Plus" small variant="secondary" onPress={() => router.push("/plan")} testID="benefits-know-plus" style={{ marginTop: space.md, alignSelf: "flex-start" }} />
        </Section>
      ) : null}

      <Section title="Beneficios comerciales activos" testID="benefits-active">
        {plus ? <Row icon="percent" tint="sage" title={`${p.prices.plus_kit_discount_pct}% de descuento Plus en kits`} subtitle="Se aplica solo el mayor descuento disponible" /> : null}
        {p.benefits.filter((b: any) => b.kind !== "plus_access").map((b: any, i: number, arr: any[]) => (
          <Row key={b.id} icon={b.kind === "credit" ? "wallet" : "percent"} tint="sage" title={label(b)} last={i === arr.length - 1} testID={`benefits-item-${b.kind}`}
            subtitle={[b.kind === "credit" ? `Disponible: ${money(b.remaining)}${b.scope === "kits" ? " · solo para kits" : ""}` : null, `hasta ${fmtDate(b.until)}`].filter(Boolean).join(" · ")} />
        ))}
        {!p.benefits.some((b: any) => b.kind !== "plus_access") && !plus ? <Txt v="caption">Sin descuentos ni créditos activos por ahora.</Txt> : null}
        <Txt v="caption" style={{ marginTop: space.sm }}>El envío estándar está incluido en el precio de todos los kits.</Txt>
      </Section>

      {inst.length ? (
        <Section title="Beneficios institucionales" testID="benefits-institutional">
          <Row icon="building-2" tint="lavender" title={p.institution} subtitle={`Te proporciona: ${inst.map((b: any) => label(b)).join(", ")}`} last />
          <Txt v="caption" style={{ marginTop: space.sm }}>Tu institución no recibe tu información médica ni tus registros.</Txt>
        </Section>
      ) : null}

      {p.expired.length ? (
        <Section title="Beneficios vencidos" testID="benefits-expired">
          {p.expired.map((b: any) => (
            <Row key={b.id} icon="clock" tint="sand" title={label(b)} subtitle={`Venció el ${fmtDate(b.until)}${b.institution ? ` · ${b.institution}` : ""}`} right={<Badge label="Vencido" tint="sand" />} />
          ))}
          <Txt v="caption" style={{ marginTop: space.sm }}>Tus datos se conservan aunque un beneficio venza.</Txt>
        </Section>
      ) : null}

      <Btn label="Tengo un código" variant="ghost" icon="ticket" onPress={() => router.push("/redeem")} testID="benefits-code" style={{ marginTop: space.lg }} />
    </Screen>
  );
}
