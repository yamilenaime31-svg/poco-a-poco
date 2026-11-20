import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { FREE_FEATURES, PLUS_FEATURES, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Ic, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";


/** Onboarding step: how to start. Free first, nothing preselected, no charge in this prototype. */
export default function ChoosePlan() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const price = useApi<any>("/me/plan").data?.prices?.plus_price ?? 79;

  const choose = async (action: "free" | "plus") => {
    setBusy(action);
    try {
      await api("/me/plan", { method: "POST", body: { action } });
      await refresh();
      invalidate();
      if (action === "plus") toast.show("Plus activado en modo demostración, sin cargo");
      router.replace("/onboarding");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const Card = ({ title, price, list, children, testID }: any) => (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={testID}>
      <View style={styles.head}>
        <Txt v="h2" style={{ flex: 1 }}>{title}</Txt>
        {price ? <Txt v="title" numberOfLines={1}>{price}</Txt> : null}
      </View>
      {list?.map((x: string) => (
        <View key={x} style={styles.li}><Ic name="check" size={14} /><Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{x}</Txt></View>
      ))}
      <View style={{ marginTop: space.md }}>{children}</View>
    </View>
  );

  return (
    <Screen back={false} title="¿Cómo quieres comenzar con AMODO?" subtitle="Elige la opción que mejor se adapte a ti. Puedes cambiarla después." testID="choose-plan-screen">
      <Card title="AMODO Gratis" price="$0" list={FREE_FEATURES} testID="choose-plan-free">
        <Btn label="Comenzar gratis" loading={busy === "free"} onPress={() => choose("free")} testID="choose-plan-free-button" />
      </Card>
      <Card title="AMODO Plus" price={`${money(price)}/mes`} list={PLUS_FEATURES} testID="choose-plan-plus">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Precio ilustrativo. En este prototipo se activa en modo demostración por 30 días, sin cobro ni datos bancarios.</Txt>
        <Btn label="Elegir Plus" variant="secondary" loading={busy === "plus"} onPress={() => choose("plus")} testID="choose-plan-plus-button" />
      </Card>
      <Card title="Tengo un código" testID="choose-plan-code">
        <Txt v="caption" color={colors.onSurface} style={{ marginTop: -space.sm, marginBottom: space.sm }}>Activa los beneficios que tu hospital o institución tiene para ti.</Txt>
        <Btn label="Ingresar código" variant="secondary" icon="ticket" onPress={() => router.push({ pathname: "/redeem", params: { onboarding: "1" } })} testID="choose-plan-code-button" />
      </Card>
      <Txt v="caption" style={{ textAlign: "center" }}>Las funciones esenciales de apoyo siempre son gratuitas.</Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, marginBottom: space.md },
  head: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginBottom: space.sm },
  li: { flexDirection: "row", gap: 6, marginTop: 4 },
});
