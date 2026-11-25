import { View } from "react-native";

import { useApi } from "@/src/api";
import { AdminScreen, Grid, Metric } from "@/src/components/admin-ui";
import { fmtDateTime, money } from "@/src/constants";
import { ErrorState, Loading, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function AdminMemberships() {
  const { colors } = useTheme();
  const q = useApi<any>("/admin/memberships");
  const m = q.data;
  return (
    <AdminScreen title="Membresías" subtitle="Datos de demostración · sin cobros reales" testID="admin-memberships">
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <Grid>
            <Metric label="Usuarios Gratis" value={m.counts.free} testID="adm-m-free" />
            <Metric label="Usuarios Plus" value={m.counts.plus} />
            <Metric label="Institucionales" value={m.counts.institutional} />
            <Metric label="Suscripciones activas" value={m.active_subscriptions} />
            <Metric label="Cancelaciones" value={m.cancelled} />
            <Metric label="Precio Plus" value={`${money(m.plus_price)}/mes`} />
            <Metric label="Créditos otorgados" value={money(m.credits_granted)} />
            <Metric label="Créditos usados" value={money(m.credits_used)} />
            <Metric label="Créditos por usar" value={money(m.credits_pending)} />
            <Metric label="Descuentos aplicados" value={money(m.discounts_applied)} />
            <Metric label="Ingresos Plus (demo)" value={money(m.revenue_memberships_demo)} />
            <Metric label="Ingresos kits (demo)" value={money(m.revenue_kits_demo)} />
          </Grid>
          <Section title="Resumen financiero de beneficios">
            <Txt v="caption" color={colors.onSurface}>Créditos y descuentos otorgados: {money(m.credits_granted + m.discounts_applied)} frente a {money(m.revenue_memberships_demo + m.revenue_kits_demo)} de ingresos de demostración.</Txt>
            <Txt v="caption" color={colors.onSurface}>Costo de IA este mes: {m.ai_cost_month !== null ? money(m.ai_cost_month) : "sin estimar (captura un costo por interacción en Ajustes)"} · {m.ai_month_calls} interacciones.</Txt>
            <Txt v="caption" style={{ marginTop: space.sm }}>{m.note}</Txt>
          </Section>
          <Section title={`Uso de IA (límites: Gratis ${m.limits.free}, Plus ${m.limits.plus} al mes)`}>
            {m.ai_by_user.length ? m.ai_by_user.map((a: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Txt v="caption" style={{ flex: 1 }}>{a.name || "Usuario"} · {a.plus ? "Plus" : "Gratis"}</Txt>
                <Txt v="caption">{a.count}</Txt>
              </View>
            )) : <Txt v="caption">Sin uso este mes.</Txt>}
          </Section>
          <Section title="Historial de suscripciones">
            {m.history.length ? m.history.map((h: any) => <Txt key={h.id} v="caption">{fmtDateTime(h.at)} · {h.action} · {money(h.price || 0)}</Txt>) : <Txt v="caption">Sin movimientos.</Txt>}
          </Section>
          <Txt v="caption" style={{ marginTop: space.lg }}>Precio, crédito mensual, descuento y límites de IA se editan en Ajustes › Planes. Los beneficios institucionales, en Códigos.</Txt>
        </>
      )}
    </AdminScreen>
  );
}
