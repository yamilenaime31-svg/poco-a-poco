import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { KitBox } from "@/src/art";
import { fmtDateTime, money } from "@/src/constants";
import { Badge, Btn, ErrorState, Ic, Loading, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

/** Shown right after a demo order is confirmed. No delivery date is promised. */
export default function OrderConfirmed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>(`/orders/${id}`);
  const o = q.data;
  return (
    <Screen back={false} title="" testID="order-confirmed-screen"
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Btn label="Volver a Inicio" variant="secondary" onPress={() => router.replace("/(tabs)")} testID="order-confirmed-home" style={{ flex: 1 }} />
          <Btn label="Ver mi pedido" onPress={() => router.replace({ pathname: "/order/[id]", params: { id } })} testID="order-confirmed-view" style={{ flex: 1 }} />
        </View>
      }>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <View style={[styles.hero, { backgroundColor: colors.sage }]}>
            <KitBox level={3} size={128} color={colors.surfaceSecondary} />
            <View style={[styles.mark, { backgroundColor: colors.surfaceInverse }]}><Ic name="check" size={20} color={colors.onSurfaceInverse} /></View>
          </View>
          <Txt v="display" testID="order-confirmed-title">Tu kit está confirmado</Txt>
          <Txt style={{ marginTop: space.xs }}>Preparamos una selección hecha a tu modo.</Txt>

          <View style={[styles.box, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.row}>
              <Txt v="caption">Pedido de demostración</Txt>
              <Txt v="title" testID="order-confirmed-number">{o.number}</Txt>
            </View>
            <View style={styles.row}><Txt v="caption">Fecha</Txt><Txt v="medium" style={{ fontSize: 14 }}>{fmtDateTime(o.created_at)}</Txt></View>
            <View style={styles.row}><Txt v="caption">Estado</Txt><Badge label={o.status} tint="sage" testID="order-confirmed-status" /></View>
            {o.items.map((i: any, k: number) => (
              <View key={k} style={[styles.item, { borderTopColor: colors.divider }]}>
                <Txt v="medium">{i.qty > 1 ? `${i.qty} × ` : ""}{i.name}</Txt>
                {i.detail ? <Txt v="caption" numberOfLines={2}>{i.detail}</Txt> : null}
              </View>
            ))}
            <View style={[styles.row, styles.item, { borderTopColor: colors.divider }]}><Txt v="caption">Envío</Txt><Txt v="medium" style={{ fontSize: 14 }}>Incluido</Txt></View>
            <View style={styles.row}><Txt v="title">Total</Txt><Txt v="h2" testID="order-confirmed-total">{money(o.total)}</Txt></View>
            <Txt v="caption" style={{ marginTop: space.sm }}>{o.address.recipient} · {o.address.street}, {o.address.city}, C.P. {o.address.zip}</Txt>
          </View>

          <View style={[styles.note, { backgroundColor: colors.surfaceTertiary }]} testID="order-confirmed-demo">
            <Ic name="info" size={16} color={colors.muted} />
            <Txt v="caption" style={{ flex: 1 }}>Es una simulación: no se realizó ningún cobro y no habrá un envío real. Te avisaremos cuando cambie el estado; la fecha de entrega se confirmará cuando el pedido esté en camino.</Txt>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, alignItems: "center", justifyContent: "center", paddingVertical: space.lg, marginBottom: space.lg },
  mark: { position: "absolute", right: space.lg, top: space.lg, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.lg, padding: space.lg, marginTop: space.xl, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, marginTop: 2 },
  note: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.lg },
});
