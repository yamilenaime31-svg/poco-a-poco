import { DateField } from "@/src/pickers";
import { useState } from "react";
import { View } from "react-native";

import { api, invalidate, useApi } from "@/src/api";
import { AdminScreen, NumField } from "@/src/components/admin-ui";
import { fmtDate, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Chip, ChipRow, Field, Loading, Sheet, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const TYPES = ["Hospital", "Clínica", "Fundación", "Asociación", "Aseguradora"];
const blank = { code: "", institution: "", institution_type: "Hospital", benefits: { plus_months: 3, kit_discount_pct: 15, credit: 150 }, valid_from: "", valid_until: "", max_uses: 50, budget: 5000, status: "activo", conditions: "" };

export default function AdminCodes() {
  const toast = useToast();
  const q = useApi<any[]>("/admin/codes");
  const [e, setE] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const setB = (k: string) => (v: string) => setE({ ...e, benefits: { ...e.benefits, [k]: v } });
  const save = async () => {
    try {
      await api("/admin/codes", { method: "POST", body: e });
      invalidate();
      setE(null);
      toast.show("Código guardado");
    } catch (err: any) {
      toast.show(err.message, "error");
    }
  };
  return (
    <AdminScreen title="Códigos institucionales" subtitle="Beneficios de ejemplo; no representan convenios existentes" testID="admin-codes"
      footer={<Btn label="Crear código" icon="plus" onPress={() => setE(blank)} testID="admin-code-add" />}>
      {q.isLoading ? <Loading /> : (q.data || []).map((c) => {
        const expired = c.valid_until < today;
        return (
          <Card key={c.id} style={{ marginBottom: space.md }} onPress={() => setE(c)} testID={`admin-code-${c.code}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm, alignItems: "center" }}>
              <Txt v="title" style={{ flex: 1 }}>{c.code}</Txt>
              <Badge label={expired ? "Vencido" : c.status} tint={expired || c.status !== "activo" ? "coral" : "sage"} />
            </View>
            <Txt v="caption">{c.institution} · {c.institution_type}</Txt>
            <Txt v="caption">Plus {c.benefits.plus_months} mes(es) · {c.benefits.kit_discount_pct}% en kits · crédito {money(c.benefits.credit)}{c.benefits.funded_kit ? ` · kit ${c.benefits.funded_kit.toLowerCase()} financiado` : ""}</Txt>
            {c.activated_by?.length ? <Txt v="caption" numberOfLines={2}>Activado por: {c.activated_by.join(", ")}</Txt> : null}
            <Txt v="caption">{fmtDate(c.valid_from)} – {fmtDate(c.valid_until)} · usos {c.uses}/{c.max_uses} · activaciones {c.activations}</Txt>
            {c.budget != null ? <Txt v="caption">Presupuesto: {money(c.budget_used)} de {money(c.budget)}</Txt> : null}
          </Card>
        );
      })}
      <Sheet visible={!!e} onClose={() => setE(null)} title={e?.id ? "Editar código" : "Nuevo código"} testID="admin-code-sheet">
        {e ? (
          <>
            <Field label="Código" value={e.code} autoCapitalize="characters" onChangeText={(v) => setE({ ...e, code: v.toUpperCase() })} testID="admin-code-code" />
            <Field label="Institución" value={e.institution} onChangeText={(v) => setE({ ...e, institution: v })} testID="admin-code-institution" />
            <ChipRow>{TYPES.map((t) => <Chip key={t} label={t} selected={e.institution_type === t} onPress={() => setE({ ...e, institution_type: t })} />)}</ChipRow>
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
              <NumField label="Meses Plus" value={e.benefits.plus_months} onChange={setB("plus_months")} testID="admin-code-plus" />
              <NumField label="% en kits" value={e.benefits.kit_discount_pct} onChange={setB("kit_discount_pct")} testID="admin-code-pct" />
              <NumField label="Crédito $" value={e.benefits.credit} onChange={setB("credit")} testID="admin-code-credit" />
            </View>
            <Txt v="label" style={{ marginBottom: space.sm }}>Kit financiado</Txt>
            <ChipRow>{[["", "Ninguno"], ["Chico", "Kit chico"], ["Mediano", "Kit mediano"], ["Grande", "Kit grande"]].map(([k, l]) => <Chip key={k} label={l} selected={(e.benefits.funded_kit || "") === k} onPress={() => setB("funded_kit")(k)} testID={`admin-code-kit-${k || "none"}`} />)}</ChipRow>
            <View style={{ height: space.md }} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <View style={{ flex: 1 }}><DateField label="Desde" value={e.valid_from || ""} onChange={(v) => setE({ ...e, valid_from: v })} testID="admin-code-from" compact /></View>
              <View style={{ flex: 1 }}><DateField label="Hasta" value={e.valid_until || ""} onChange={(v) => setE({ ...e, valid_until: v })} testID="admin-code-until" compact /></View>
            </View>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <NumField label="Límite de usos / beneficiarios" value={e.max_uses} onChange={(v) => setE({ ...e, max_uses: v })} testID="admin-code-max" />
              <NumField label="Presupuesto $" value={e.budget} onChange={(v) => setE({ ...e, budget: v })} />
            </View>
            <ChipRow>{["activo", "pausado"].map((t) => <Chip key={t} label={t} selected={e.status === t} onPress={() => setE({ ...e, status: t })} />)}</ChipRow>
            <Field label="Condiciones" value={e.conditions} onChangeText={(v) => setE({ ...e, conditions: v })} multiline style={{ marginTop: space.md }} />
            <Btn label="Guardar código" onPress={save} testID="admin-code-save" />
          </>
        ) : null}
      </Sheet>
    </AdminScreen>
  );
}
