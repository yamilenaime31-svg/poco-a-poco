import { useState } from "react";
import { ScrollView, View } from "react-native";

import { api, invalidate, useApi } from "@/src/api";
import { AdminScreen, NumField, tableRow } from "@/src/components/admin-ui";
import { fmtDateTime } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Chip, ChipRow, Field, Loading, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function AdminInventory() {
  const toast = useToast();
  const { colors } = useTheme();
  const prods = useApi<any[]>("/admin/products");
  const moves = useApi<any[]>("/admin/inventory");
  const [pid, setPid] = useState("");
  const [type, setType] = useState("entrada");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const names: Record<string, string> = Object.fromEntries((prods.data || []).map((p) => [p.id, p.name]));
  const sel = (prods.data || []).find((p) => p.id === pid);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api("/admin/inventory", { method: "POST", body: { product_id: pid, type, qty: Number(qty), note } });
      invalidate();
      toast.show(`Movimiento registrado. Existencias: ${r.stock}`);
      setQty("");
      setNote("");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminScreen title="Inventario" subtitle="Movimientos simulados · los pedidos reservan stock y se descuenta al enviarse" testID="admin-inventory">
      <Txt v="label" style={{ marginBottom: space.sm }}>Artículo</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}>
        {(prods.data || []).map((p) => <Chip key={p.id} label={`${p.name} (${(p.stock || 0) - (p.stock_reserved || 0)})`} selected={pid === p.id} onPress={() => setPid(p.id)} testID={`admin-inv-product-${p.id}`} />)}
      </ScrollView>
      {sel ? <Txt v="caption" style={{ marginTop: space.sm }} testID="admin-inv-selected">Existencias: {sel.stock} · reservadas: {sel.stock_reserved || 0} · disponibles: {(sel.stock || 0) - (sel.stock_reserved || 0)}</Txt> : null}
      <Txt v="label" style={{ marginVertical: space.sm }}>Tipo</Txt>
      <ChipRow>{["entrada", "salida", "ajuste"].map((t) => <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} testID={`admin-inv-type-${t}`} />)}</ChipRow>
      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
        <NumField label={type === "ajuste" ? "Cantidad (+/-)" : "Cantidad"} value={qty} onChange={setQty} testID="admin-inv-qty" />
        <View style={{ flex: 2 }}><Field label="Nota" value={note} onChangeText={setNote} testID="admin-inv-note" /></View>
      </View>
      <Btn label="Registrar movimiento" disabled={!pid || !Number(qty)} loading={busy} onPress={submit} testID="admin-inv-submit" />
      <Section title="Movimientos recientes">
        {moves.isLoading ? <Loading /> : (moves.data || []).slice(0, 60).map((m) => (
          <View key={m.id} style={tableRow(colors)}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="medium" style={{ fontSize: 14 }} numberOfLines={1}>{names[m.product_id] || m.product_id}</Txt>
              <Txt v="caption" numberOfLines={1}>{m.note} · {fmtDateTime(m.at)}</Txt>
            </View>
            <Badge label={`${m.type} ${m.qty > 0 && m.type !== "salida" ? "+" : ""}${m.qty}`} tint={m.type === "entrada" ? "sage" : m.type === "salida" ? "coral" : "sand"} />
          </View>
        ))}
      </Section>
    </AdminScreen>
  );
}
