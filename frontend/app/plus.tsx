import { Shape } from "@/src/art";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { money, plusBenefits, plusTagline } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Ic, Loading, Screen, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** Simulated Plus subscription: summary, price, benefits, renewal & cancellation terms, explicit confirmation. */
export default function PlusCheckout() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { refresh, user } = useAuth();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const q = useApi<any>("/me/plan");
  const [busy, setBusy] = useState(false);
  const p = q.data;
  if (!p) return <Screen title="AMODO Plus"><Loading /></Screen>;
  const c = p.prices;

  const activate = async () => {
    setBusy(true);
    try {
      await api("/me/plus/activate", { method: "POST" });
      await refresh();
      invalidate();
      router.replace({ pathname: "/plus-welcome", params: onboarding ? { onboarding: "1" } : {} });
    } catch (e: any) {
      toast.show(e.message, "error");
      setBusy(false);
    }
  };

  return (
    <Screen title="AMODO Plus" subtitle={plusTagline(user?.role)} testID="plus-screen"
      footer={p.tier === "plus" ? <Btn label="Ya tienes AMODO Plus" disabled onPress={() => {}} /> : (
        <>
          <Btn label={`Activar Plus · ${money(c.plus_price)} al mes`} loading={busy} onPress={activate} testID="plus-activate-button" />
          <Btn label="Ahora no" variant="ghost" onPress={() => (onboarding ? router.replace("/onboarding") : router.back())} testID="plus-not-now" />
          <Txt v="caption" style={{ textAlign: "center" }}>Activación de demostración. No se realizará ningún cobro real.</Txt>
        </>
      )}>
      <View style={[styles.price, { backgroundColor: colors.lavender }]}>
        <View style={{ position: "absolute", right: -20, top: -24 }} pointerEvents="none"><Shape name="burst" size={120} color={colors.butter} /></View>
        <Txt v="display" testID="plus-price">{money(c.plus_price)}</Txt>
        <Txt v="caption">al mes, impuestos incluidos · sin permanencia</Txt>
      </View>
      <Section title="Lo que cambia para ti">
        {plusBenefits(c, user?.role).map((b) => (
          <View key={b.t} style={styles.li}>
            <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: colors.lavenderSoft, alignItems: "center", justifyContent: "center" }}><Ic name={b.i} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Txt v="medium">{b.t}</Txt>
              <Txt v="caption">{b.s}</Txt>
            </View>
          </View>
        ))}
        <Txt v="caption" style={{ marginTop: space.sm }}>Todo lo de AMODO Gratis sigue incluido. El envío estándar está incluido en todos los kits, con cualquier plan.</Txt>
      </Section>
      <Section title="Renovación y cancelación" testID="plus-terms">
        <Txt v="caption" color={colors.onSurface}>• Se renueva cada 30 días mientras la mantengas activa.</Txt>
        <Txt v="caption" color={colors.onSurface}>• Puedes cancelar cuando quieras desde Perfil › Mi plan AMODO, sin penalización.</Txt>
        <Txt v="caption" color={colors.onSurface}>• Si cancelas, conservas tu información y los créditos que ya recibiste, y sigues con AMODO Gratis.</Txt>
        <Txt v="caption" color={colors.onSurface}>• Los créditos no se cambian por efectivo ni se transfieren.</Txt>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  price: { borderRadius: 24, padding: space.lg, marginTop: space.sm, overflow: "hidden" },
  li: { flexDirection: "row", gap: space.md, paddingVertical: space.sm },
});
