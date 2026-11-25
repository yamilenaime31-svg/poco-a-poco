import { useState } from "react";
import { View } from "react-native";

import { useApi } from "@/src/api";
import { AdminScreen } from "@/src/components/admin-ui";
import { money } from "@/src/constants";
import { Card, Chip, ChipRow, ErrorState, Loading, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

function L({ l, r }: { l: string; r: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
      <Txt v="caption" style={{ flex: 1 }}>{l}</Txt>
      <Txt v="caption">{r}</Txt>
    </View>
  );
}

/** Profitability per kit size across item combinations (cheapest, median, p90, most expensive allowed). */
export default function Profitability() {
  const { colors } = useTheme();
  const [plus, setPlus] = useState(true);
  const q = useApi<any>(`/admin/profitability?plus_discount=${plus}`);
  const d = q.data;
  return (
    <AdminScreen title="Rentabilidad de kits" subtitle="Precios provisionales · envío incluido para el cliente" testID="admin-profitability">
      <ChipRow>
        <Chip label="Con descuento Plus" selected={plus} onPress={() => setPlus(true)} testID="profit-plus-on" />
        <Chip label="Sin descuento" selected={!plus} onPress={() => setPlus(false)} testID="profit-plus-off" />
      </ChipRow>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <Txt v="caption" style={{ marginTop: space.md }}>{d.note}</Txt>
          {d.sizes.map((s: any) => (
            <Section key={s.size.id} title={`${s.size.label} · ${money(s.size.base)} (provisional)`} testID={`profit-${s.size.id}`}>
              {Object.entries(s.scenarios).map(([name, k]: any) => (
                <Card key={name} style={{ marginBottom: space.sm, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt v="medium" style={{ fontSize: 14, flex: 1 }}>{name}</Txt>
                    <Txt v="medium" style={{ fontSize: 14 }} color={k.margin_after_pct < d.costs.min_margin_pct ? colors.onError : colors.onSurface}>{k.margin_after_pct}%</Txt>
                  </View>
                  <L l="Costo de artículos" r={money(k.items_cost)} />
                  <L l="Empaque, armado, envío al cliente e incidencias" r={money(k.fixed_costs)} />
                  <L l="Comisión de pago" r={money(k.payment_fee)} />
                  <L l="Impuestos" r={money(k.tax)} />
                  <L l="Costo total" r={money(k.direct_cost + k.payment_fee + k.tax)} />
                  <L l={`Precio de venta${k.discount ? " (con descuento Plus)" : ""}`} r={money(k.net_price)} />
                  <L l="Margen estimado" r={money(k.margin_after_fees_taxes)} />
                  {k.items ? <Txt v="caption" numberOfLines={2}>{k.items.join(", ")}</Txt> : null}
                </Card>
              ))}
            </Section>
          ))}
          <Section title="Suplementos premium" testID="profit-premium">
            {d.premium.map((p: any) => (
              <View key={p.name} style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.divider }}>
                <Txt v="medium" style={{ fontSize: 14 }}>{p.name}</Txt>
                <Txt v="caption">Costo {money(p.cost)} · diferencia vs. incluido promedio {money(p.extra_cost)} · suplemento {money(p.supplement)} · margen del suplemento {money(p.supplement_margin)}{p.supplement_margin_pct !== null ? ` (${p.supplement_margin_pct}%)` : ""} · {p.cost_source}</Txt>
              </View>
            ))}
          </Section>
        </>
      )}
    </AdminScreen>
  );
}
