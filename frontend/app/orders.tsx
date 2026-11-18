import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { fmtDateTime, money } from "@/src/constants";
import { Badge, Chip, Empty, Loading, Row, Screen } from "@/src/ui";
import { space } from "@/src/theme";

export default function Orders() {
  const router = useRouter();
  const q = useApi<any[]>("/orders");
  const [tab, setTab] = useState<"active" | "history">("active");
  const list = (q.data || []).filter((o) => (tab === "active" ? o.active : !o.active));
  return (
    <Screen title="Mis pedidos" testID="orders-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginTop: -space.md, height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
        <Chip label="En curso" selected={tab === "active"} onPress={() => setTab("active")} testID="orders-tab-active" />
        <Chip label="Historial de compras" selected={tab === "history"} onPress={() => setTab("history")} testID="orders-tab-history" />
      </ScrollView>
      {q.isLoading ? <Loading /> : list.length === 0 ? (
        <Empty icon="truck" title={tab === "active" ? "Sin pedidos en curso" : "Aún no hay compras anteriores"} text="Cuando hagas un pedido, podrás seguirlo aquí." action="Ir a kits" onAction={() => router.push("/(tabs)/mykits")} testID="orders-empty" />
      ) : (
        list.map((o, i) => (
          <Row key={o.id} icon="package" tint={o.active ? "sage" : "sand"} title={`Pedido ${o.number}`} subtitle={`${fmtDateTime(o.created_at)} · ${o.items.length} artículo(s) · ${money(o.total)}`} right={<Badge label={o.status} tint={o.status === "Entregado" ? "sage" : o.status === "Cancelado" ? "coral" : "lavender"} />} onPress={() => router.push(`/order/${o.id}`)} testID={`order-row-${o.id}`} last={i === list.length - 1} />
        ))
      )}
    </Screen>
  );
}
