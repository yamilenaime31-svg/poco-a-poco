import { useState } from "react";
import { View } from "react-native";

import { api, invalidate, useApi } from "@/src/api";
import { AdminScreen } from "@/src/components/admin-ui";
import { money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Field, Loading, Sheet, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function AdminSuppliers() {
  const toast = useToast();
  const q = useApi<any[]>("/admin/suppliers");
  const [edit, setEdit] = useState<any>(null);
  const save = async () => {
    try {
      await api("/admin/suppliers", { method: "POST", body: edit });
      invalidate();
      setEdit(null);
      toast.show("Proveedor guardado");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  return (
    <AdminScreen title="Proveedores" subtitle="Compra al mayoreo · todos son datos de demostración" testID="admin-suppliers"
      footer={<Btn label="Agregar proveedor" icon="plus" onPress={() => setEdit({ name: "", contact: "", lead_days: 7, terms: "", notes: "" })} testID="admin-supplier-add" />}>
      {q.isLoading ? <Loading /> : (q.data || []).map((s) => (
        <Card key={s.id} style={{ marginBottom: space.md }} onPress={() => setEdit(s)} testID={`admin-supplier-${s.id}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
            <Txt v="title" style={{ flex: 1 }}>{s.name}</Txt>
            {s.demo ? <Badge label="Demo" tint="sand" /> : null}
          </View>
          <Txt v="caption">{s.contact}</Txt>
          <Txt v="caption">Entrega estimada: {s.lead_days} días · {s.terms}</Txt>
          {s.notes ? <Txt v="caption">{s.notes}</Txt> : null}
          <Txt v="label" style={{ marginTop: space.sm }}>Suministra ({s.items.length})</Txt>
          {s.items.slice(0, 6).map((i: any) => <Txt key={i.id} v="caption">· {i.name} — {money(i.unit_cost)} c/u · mín. {i.min_order}</Txt>)}
          {s.items.length > 6 ? <Txt v="caption">y {s.items.length - 6} más</Txt> : null}
        </Card>
      ))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Editar proveedor" : "Nuevo proveedor"} testID="admin-supplier-sheet">
        {edit ? (
          <>
            <Field label="Nombre" value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} testID="admin-supplier-name" />
            <Field label="Contacto" value={edit.contact} onChangeText={(v) => setEdit({ ...edit, contact: v })} />
            <Field label="Días de entrega" value={String(edit.lead_days ?? "")} keyboardType="number-pad" onChangeText={(v) => setEdit({ ...edit, lead_days: v })} />
            <Field label="Condiciones de compra" value={edit.terms} onChangeText={(v) => setEdit({ ...edit, terms: v })} />
            <Field label="Observaciones" value={edit.notes} onChangeText={(v) => setEdit({ ...edit, notes: v })} />
            <Btn label="Guardar" onPress={save} testID="admin-supplier-save" />
          </>
        ) : null}
      </Sheet>
    </AdminScreen>
  );
}
