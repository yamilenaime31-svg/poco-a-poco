import { ScrollView, View } from "react-native";

import { api, invalidate, useApi } from "@/src/api";
import { AdminScreen } from "@/src/components/admin-ui";
import { fmtDateTime, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Card, Chip, Loading, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const NEXT = ["Confirmado", "En preparación", "Enviado", "Entregado", "Cancelado"];

export default function AdminOrders() {
  const toast = useToast();
  const q = useApi<any[]>("/admin/orders");
  const move = async (id: string, status: string) => {
    try {
      await api(`/admin/orders/${id}/status`, { method: "POST", body: { status } });
      invalidate();
      toast.show(`Pedido: ${status}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  return (
    <AdminScreen title="Pedidos" subtitle="Pedidos de demostración · ningún pago se procesa" testID="admin-orders">
      {q.isLoading ? <Loading /> : (q.data || []).map((o) => {
        const status = o.status || (o.cancelled ? "Cancelado" : "Confirmado");
        const closed = ["Entregado", "Cancelado"].includes(status);
        return (
          <Card key={o.id} style={{ marginBottom: space.md }} testID={`admin-order-${o.number}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm, alignItems: "center" }}>
              <Txt v="title" style={{ flex: 1 }}>{o.number}</Txt>
              <Badge label={status} tint={status === "Cancelado" ? "coral" : "sage"} testID={`admin-order-status-${o.number}`} />
            </View>
            <Txt v="caption">{fmtDateTime(o.created_at)} · {o.items.length} línea(s) · total {money(o.total)}</Txt>
            {o.reserved ? <Txt v="caption">Reserva: {Object.values(o.reserved).reduce((a: number, b: any) => a + b, 0)} artículo(s)</Txt> : null}
            {!closed ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm }}>
                {NEXT.filter((s) => s !== status).map((s) => <Chip key={s} label={s} onPress={() => move(o.id, s)} testID={`admin-order-${o.number}-${s}`} />)}
              </ScrollView>
            ) : null}
          </Card>
        );
      })}
    </AdminScreen>
  );
}
