import { useEffect, useState } from "react";
import { View } from "react-native";

import { api, invalidate, useApi } from "@/src/api";
import { AdminScreen, NumField } from "@/src/components/admin-ui";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Loading, Section, Sheet, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const COSTS = [["packaging", "Empaque"], ["assembly", "Armado"], ["labels", "Etiquetas"], ["protection", "Material de protección"], ["storage", "Almacenamiento"], ["logistics", "Logística interna"], ["shipping", "Envío estimado (lo absorbe AMODO)"], ["incidents", "Reserva incidencias"], ["payment_fee_pct", "Comisión de pago %"], ["tax_pct", "IVA %"], ["min_margin_pct", "Margen mínimo %"]];

export default function AdminSettings() {
  const toast = useToast();
  const q = useApi<any>("/admin/overview");
  const [sizes, setSizes] = useState<any[] | null>(null);
  const [costs, setCosts] = useState<any>(null);
  const [plans, setPlans] = useState<any>(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (q.data && !sizes) { setSizes(q.data.sizes); setCosts(q.data.costs); setPlans(q.data.plans); }
  }, [q.data, sizes]);
  if (!sizes || !costs || !plans) return <AdminScreen title="Ajustes"><Loading /></AdminScreen>;

  const save = async (key: string, value: any) => {
    try {
      await api(`/admin/settings/${key}`, { method: "PUT", body: { value } });
      invalidate();
      toast.show("Ajustes guardados. Se aplican a nuevos presupuestos.");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const num = (o: any, set: (x: any) => void, k: string) => (v: string) => set({ ...o, [k]: v === "" ? "" : Number(v) });

  return (
    <AdminScreen title="Ajustes" subtitle="Valores ilustrativos del prototipo" testID="admin-settings"
      overlay={<Sheet visible={ask} onClose={() => setAsk(false)} title="¿Guardar cambios en planes?" testID="admin-plans-confirm">
        <Txt style={{ marginBottom: space.lg }}>Plus {plans.plus_price ? `$${plans.plus_price}` : ""} al mes, crédito ${plans.monthly_credit}, descuento {plans.plus_kit_discount_pct}%. No cambia beneficios ya adquiridos.</Txt>
        <Btn label="Confirmar" onPress={() => { setAsk(false); save("plans", plans); }} testID="admin-plans-confirm-button" />
      </Sheet>}>
      <Section title="Tamaños y precio base">
        {sizes.map((s, i) => (
          <View key={s.id} style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            <Txt v="medium" style={{ width: 86 }}>{s.label}</Txt>
            <NumField label="Artículos" value={s.max} onChange={(v) => setSizes(sizes.map((x, j) => (j === i ? { ...x, max: v } : x)))} testID={`admin-size-max-${s.id}`} />
            <NumField label="Precio base $" value={s.base} onChange={(v) => setSizes(sizes.map((x, j) => (j === i ? { ...x, base: v } : x)))} testID={`admin-size-base-${s.id}`} />
          </View>
        ))}
        <Btn label="Guardar tamaños" variant="secondary" onPress={() => save("sizes", sizes)} testID="admin-save-sizes" />
      </Section>
      <Section title="Costos de preparación y comisiones">
        {[0, 2, 4, 6, 8, 10].map((i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
            {COSTS.slice(i, i + 2).map(([k, l]) => <NumField key={k} label={l} value={costs[k]} onChange={num(costs, setCosts, k)} testID={`admin-cost-${k}`} />)}
          </View>
        ))}
        <Btn label="Guardar costos" variant="secondary" onPress={() => save("costs", costs)} testID="admin-save-costs" />
      </Section>
      <Section title="Planes y reglas de descuento">
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <NumField label="Precio Plus $/mes" value={plans.plus_price} onChange={num(plans, setPlans, "plus_price")} testID="admin-plan-price" />
          <NumField label="Descuento Plus en kits %" value={plans.plus_kit_discount_pct} onChange={num(plans, setPlans, "plus_kit_discount_pct")} testID="admin-plan-discount" />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <NumField label="Crédito mensual Plus $" value={plans.monthly_credit} onChange={num(plans, setPlans, "monthly_credit")} testID="admin-plan-credit" />
          <NumField label="Costo estimado IA $/interacción" value={plans.ai_cost_estimate ?? ""} onChange={num(plans, setPlans, "ai_cost_estimate")} testID="admin-plan-ai-cost" />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <NumField label="IA Gratis / mes" value={plans.ai_limit_free} onChange={num(plans, setPlans, "ai_limit_free")} testID="admin-plan-ai-free" />
          <NumField label="IA Plus / mes" value={plans.ai_limit_plus} onChange={num(plans, setPlans, "ai_limit_plus")} testID="admin-plan-ai-plus" />
        </View>
        <Txt v="caption" style={{ marginBottom: space.sm }}>Los cambios aplican a nuevas activaciones; quienes ya tienen Plus conservan el precio, crédito y descuento con que lo activaron.</Txt>
        <Txt v="label" style={{ marginBottom: space.sm }}>Combinación de descuentos</Txt>
        <ChipRow>
          <Chip label="Solo el mayor" selected={plans.stacking === "best"} onPress={() => setPlans({ ...plans, stacking: "best" })} testID="admin-stacking-best" />
          <Chip label="Sumar con tope" selected={plans.stacking === "sum"} onPress={() => setPlans({ ...plans, stacking: "sum" })} testID="admin-stacking-sum" />
        </ChipRow>
        {plans.stacking === "sum" ? <View style={{ marginTop: space.md }}><NumField label="Tope de descuento %" value={plans.max_discount_pct} onChange={num(plans, setPlans, "max_discount_pct")} /></View> : null}
        <Btn label="Guardar planes" variant="secondary" onPress={() => setAsk(true)} testID="admin-save-plans" style={{ marginTop: space.md }} />
      </Section>
    </AdminScreen>
  );
}
