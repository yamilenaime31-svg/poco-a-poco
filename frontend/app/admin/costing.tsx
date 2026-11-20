import { useEffect, useState } from "react";
import { View } from "react-native";

import { api, useApi } from "@/src/api";
import { AdminScreen, Grid, Metric, NumField } from "@/src/components/admin-ui";
import { money } from "@/src/constants";
import { Chip, ChipRow, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** Kit cost simulator: all figures come from the server-side formulas and editable cost settings. */
export default function AdminCosting() {
  const { colors } = useTheme();
  const sizes = useApi<any[]>("/kit-sizes");
  const [size, setSize] = useState("Chico");
  const [costs, setCosts] = useState<string[]>(["35", "35", "35", "35"]);
  const [discount, setDiscount] = useState("0");
  const [r, setR] = useState<any>(null);
  const max = (sizes.data || []).find((s) => s.id === size)?.max || 4;

  useEffect(() => {
    setCosts((c) => Array.from({ length: max }, (_, i) => c[i] ?? "35"));
  }, [max]);
  useEffect(() => {
    const t = setTimeout(() => api("/admin/costing", { method: "POST", body: { size, item_costs: costs.map((x) => Number(x) || 0), discount: Number(discount) || 0 } }).then(setR).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [size, costs, discount]);

  return (
    <AdminScreen title="Costeo y márgenes" subtitle="Ejemplo editable · gastos fijos y comisiones desde Ajustes" testID="admin-costing">
      <ChipRow>{(sizes.data || []).map((s) => <Chip key={s.id} label={`${s.label} · ${money(s.base)}`} selected={size === s.id} onPress={() => setSize(s.id)} testID={`admin-cost-size-${s.id}`} />)}</ChipRow>
      <Txt v="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>Costo de adquisición por artículo</Txt>
      {Array.from({ length: Math.ceil(max / 2) }, (_, row) => (
        <View key={row} style={{ flexDirection: "row", gap: space.sm }}>
          {[0, 1].map((c) => { const i = row * 2 + c; return i < max ? <NumField key={i} label={`Artículo ${i + 1}`} value={costs[i]} onChange={(v) => setCosts(costs.map((x, j) => (j === i ? v : x)))} testID={`admin-cost-item-${i}`} /> : <View key={i} style={{ flex: 1 }} />; })}
        </View>
      ))}
      <NumField label="Descuento aplicado ($)" value={discount} onChange={setDiscount} testID="admin-cost-discount" />
      {r ? (
        <Section title="Resultado" testID="admin-cost-result">
          <Grid>
            <Metric label="Precio de venta" value={money(r.net_price)} />
            <Metric label="Costo de artículos" value={money(r.items_cost)} testID="admin-cost-items" />
            <Metric label="Empaque, armado e incidencias" value={money(r.fixed_costs)} />
            <Metric label="Costo directo estimado" value={money(r.direct_cost)} testID="admin-cost-direct" />
            <Metric label="Margen bruto" value={money(r.gross_margin)} testID="admin-cost-margin" />
            <Metric label="Margen %" value={`${r.gross_margin_pct}%`} testID="admin-cost-margin-pct" />
            <Metric label="Comisión de pago" value={money(r.payment_fee)} />
            <Metric label="IVA incluido" value={money(r.tax)} />
          </Grid>
          <Txt style={{ marginTop: space.md }} testID="admin-cost-after">Después de comisión e IVA: {money(r.margin_after_fees_taxes)} ({r.margin_after_pct}%). No incluye gastos generales.</Txt>
          {!r.viable ? <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.sm, backgroundColor: colors.coralSoft, padding: space.sm, borderRadius: 8 }} testID="admin-cost-alert">Margen por debajo del mínimo configurado. Revisa la clasificación de los artículos o configura suplementos; el precio mostrado a usuarios no cambia automáticamente.</Txt> : null}
        </Section>
      ) : null}
    </AdminScreen>
  );
}
