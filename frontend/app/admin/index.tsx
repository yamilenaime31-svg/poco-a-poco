import { View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { AdminScreen, Grid, Metric } from "@/src/components/admin-ui";
import { money } from "@/src/constants";
import { ErrorState, Ic, Loading, Row, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const LINKS = [
  { t: "Artículos", s: "Costos, clasificación, suplementos y estado", i: "package", h: "/admin/products" },
  { t: "Inventario", s: "Entradas, salidas, ajustes y reservas", i: "boxes", h: "/admin/inventory" },
  { t: "Costeo y márgenes", s: "Simula el costo de un kit", i: "calculator", h: "/admin/costing" },
  { t: "Proveedores", s: "Mayoristas y condiciones de compra", i: "truck", h: "/admin/suppliers" },
  { t: "Códigos institucionales", s: "Beneficios, vigencia y activaciones", i: "ticket", h: "/admin/codes" },
  { t: "Pedidos", s: "Estados y reservas de inventario", i: "receipt", h: "/admin/orders" },
  { t: "Catálogo: exportar e importar costos", s: "CSV o Excel con todos los artículos y variantes", i: "file-spreadsheet", h: "/admin/catalog" },
  { t: "Rentabilidad de kits", s: "Combinaciones económica, mediana y de mayor costo", i: "chart-column", h: "/admin/profitability" },
  { t: "Membresías", s: "Planes, créditos, descuentos y uso de IA", i: "users", h: "/admin/memberships" },
  { t: "Ajustes", s: "Tamaños, precios base, costos y planes", i: "settings", h: "/admin/settings" },
];

export default function AdminHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>("/admin/overview");
  const o = q.data;
  return (
    <AdminScreen title="Administración" subtitle="Modelo de compra al mayoreo · datos de demostración" testID="admin-screen">
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <>
          <Grid>
            <Metric label="Artículos" value={o.products} testID="admin-metric-products" />
            <Metric label="Agotados o inactivos" value={o.out_of_stock} testID="admin-metric-out" />
            <Metric label="Valor del inventario (costo)" value={money(Math.round(o.inventory_value))} />
            <Metric label="Pedidos abiertos" value={`${o.orders_open} de ${o.orders}`} />
            <Metric label="Ventas de demostración" value={money(o.revenue_demo)} />
            <Metric label="Activaciones de códigos" value={o.activations} />
          </Grid>
          <Section title={`Alertas de rentabilidad (${o.alerts.length})`} testID="admin-alerts">
            {o.alerts.length ? o.alerts.map((a: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.coralSoft, marginBottom: space.sm }}>
                <Ic name="triangle-alert" size={16} />
                <Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{a.text}</Txt>
              </View>
            )) : <Txt v="caption">Sin alertas: todas las combinaciones incluidas cumplen el margen mínimo.</Txt>}
            <Txt v="caption">Los precios mostrados a usuarios no cambian solos; ajusta suplementos o clasificaciones manualmente.</Txt>
          </Section>
          <Section title="Gestión">
            {LINKS.map((l, i) => <Row key={l.h} icon={l.i} tint="sand" title={l.t} subtitle={l.s} onPress={() => router.push(l.h as any)} testID={`admin-link-${l.h.split("/").pop()}`} last={i === LINKS.length - 1} />)}
          </Section>
        </>
      )}
    </AdminScreen>
  );
}
