import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { AdminScreen, NumField } from "@/src/components/admin-ui";
import { CATEGORIES, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Field, Loading, ProductImage, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const NUMS = [["unit_cost", "Costo unitario mayoreo"], ["prep_cost", "Costo de preparación"], ["min_order", "Compra mínima"], ["ref_price", "Precio comercial de referencia"], ["price", "Precio suelto (ejemplo)"], ["supplement", "Suplemento premium"]];

export default function AdminProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useApi<any[]>("/admin/products");
  const sup = useApi<any[]>("/admin/suppliers");
  const [v, setV] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = (q.data || []).find((x) => x.id === id);
    if (p && !v) setV(p);
  }, [q.data, id, v]);
  if (!v) return <AdminScreen title="Artículo"><Loading /></AdminScreen>;
  const set = (k: string) => (x: any) => setV({ ...v, [k]: x });
  const save = async () => {
    setBusy(true);
    try {
      await api(`/admin/products/${id}`, { method: "PUT", body: { ...v, supplement: v.tier === "premium" ? v.supplement : 0 } });
      invalidate();
      toast.show("Artículo actualizado");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminScreen title="Editar artículo" subtitle={`${v.sku} · stock ${v.stock ?? 0} (reservado ${v.stock_reserved ?? 0})`} testID="admin-product-edit"
      footer={<Btn label="Guardar" icon="check" loading={busy} onPress={save} testID="admin-product-save" />}>
      <ProductImage product={v} height={120} style={{ width: 120, marginBottom: space.md }} />
      <Field label="SKU" value={v.sku} onChangeText={set("sku")} testID="admin-field-sku" />
      <Field label="Nombre" value={v.name} onChangeText={set("name")} testID="admin-field-name" />
      <Field label="Descripción" value={v.description} onChangeText={set("description")} multiline testID="admin-field-description" />
      <Txt v="label" style={{ marginBottom: space.sm }}>Categoría</Txt>
      <ChipRow>{CATEGORIES.map((c) => <Chip key={c.label} label={c.label} selected={v.category === c.label} onPress={() => set("category")(c.label)} />)}</ChipRow>
      <Txt v="label" style={{ marginVertical: space.sm }}>Clasificación</Txt>
      <ChipRow>{["incluido", "premium"].map((t) => <Chip key={t} label={t === "premium" ? "Premium" : "Incluido"} selected={v.tier === t} onPress={() => set("tier")(t)} testID={`admin-tier-${t}`} />)}</ChipRow>
      <Txt v="label" style={{ marginVertical: space.sm }}>Estado</Txt>
      <ChipRow>{["activo", "agotado", "descontinuado"].map((t) => <Chip key={t} label={t} selected={v.status === t} onPress={() => set("status")(t)} testID={`admin-status-${t}`} />)}</ChipRow>
      <Txt v="label" style={{ marginVertical: space.sm }}>Tamaños compatibles</Txt>
      <ChipRow>{["Chico", "Mediano", "Grande"].map((t) => <Chip key={t} label={t} selected={(v.sizes || []).includes(t)} onPress={() => set("sizes")((v.sizes || []).includes(t) ? v.sizes.filter((x: string) => x !== t) : [...(v.sizes || []), t])} />)}</ChipRow>
      <Txt v="label" style={{ marginVertical: space.sm }}>Proveedor</Txt>
      <ChipRow>{(sup.data || []).map((s) => <Chip key={s.id} label={s.name} selected={v.supplier_id === s.id} onPress={() => set("supplier_id")(s.id)} />)}</ChipRow>
      <View style={{ height: space.md }} />
      {[0, 2, 4].map((i) => (
        <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
          {NUMS.slice(i, i + 2).map(([k, l]) => (k === "supplement" && v.tier !== "premium" ? <View key={k} style={{ flex: 1 }} /> : <NumField key={k} label={l} value={v[k]} onChange={set(k)} testID={`admin-field-${k}`} />))}
        </View>
      ))}
      <Txt v="caption">Costo directo por unidad: {money(Number(v.unit_cost || 0) + Number(v.prep_cost || 0))}. El precio de referencia solo se usa si es verificable.</Txt>
    </AdminScreen>
  );
}
