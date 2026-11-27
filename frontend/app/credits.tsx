import { View } from "react-native";
import { useRouter } from "expo-router";

import { useApi } from "@/src/api";
import { PlusTag } from "@/src/components/plus-gate";
import { fmtDate, fmtDateTime, money } from "@/src/constants";
import { Btn, ErrorState, Loading, Row, Screen, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

/** Mis créditos: Plus monthly credits and institutional credits, kept apart. */
export default function Credits() {
  const router = useRouter();
  const { colors } = useTheme();
  const q = useApi<any>("/wallet");
  const w = q.data;
  return (
    <Screen title="Mis créditos" testID="credits-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <Txt v="display" testID="credits-available">{money(w.available)}</Txt>
            <Txt v="caption">disponibles para kits y suplementos premium</Txt>
          </View>
          <Section title="Créditos AMODO Plus">
            <Row icon="calendar-check" tint="sand" title={`${money(w.plus)} disponibles`} subtitle={`Recibidos: ${money(w.earned)} · Usados: ${money(w.used)}`} testID="credits-plus" />
            {w.next_credit ? <PlusTag why="Estos créditos llegan cada mes por tu membresía." testID="credits-plus-tag" style={{ marginTop: 0, marginBottom: 6 }} /> : null}
            {w.next_credit ? <Txt v="caption" testID="credits-next">Cada mes con AMODO Plus recibes {money(w.monthly_credit)} para personalizar tus próximos kits. Próxima acreditación: {fmtDate(w.next_credit)}.</Txt>
              : <View><Txt v="caption">Con AMODO Plus recibes créditos cada mes para personalizar tus kits.</Txt><Btn label="Conocer AMODO Plus" small variant="secondary" onPress={() => router.push("/plus")} testID="credits-know-plus" style={{ alignSelf: "flex-start", marginTop: space.sm }} /></View>}
          </Section>
          <Section title="Créditos institucionales">
            {w.institution.length ? w.institution.map((b: any, i: number) => (
              <Row key={i} icon="building-2" tint="sand" title={`${money(b.remaining)} de ${money(b.value)}`} subtitle={`${b.institution} · ${b.label}${b.kits_only ? " · solo kits" : ""} · hasta ${fmtDate(b.until)}`} last={i === w.institution.length - 1} />
            )) : <Txt v="caption">No tienes créditos de una institución. Si tienes un código, actívalo en Perfil.</Txt>}
          </Section>
          <Section title="Movimientos" testID="credits-moves">
            {w.moves.length ? w.moves.map((m: any, i: number) => (
              <View key={m.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm, paddingVertical: space.sm, borderBottomWidth: i === w.moves.length - 1 ? 0 : 0.5, borderBottomColor: colors.divider }}>
                <View style={{ flex: 1 }}>
                  <Txt v="medium" style={{ fontSize: 14 }}>{m.text}</Txt>
                  <Txt v="caption">{fmtDateTime(m.at)}</Txt>
                </View>
                <Txt v="medium" style={{ fontSize: 14 }}>{m.amount > 0 ? "+" : "−"}{money(Math.abs(m.amount))}</Txt>
              </View>
            )) : <Txt v="caption">Sin movimientos todavía.</Txt>}
          </Section>
          <View style={{ padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, marginTop: space.lg, gap: 2 }}>
            {w.rules.map((r: string) => <Txt key={r} v="caption">• {r}</Txt>)}
          </View>
        </>
      )}
    </Screen>
  );
}
