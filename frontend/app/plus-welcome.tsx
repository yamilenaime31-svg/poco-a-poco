import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useApi } from "@/src/api";
import { money } from "@/src/constants";
import { Btn, Ic, Row, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export default function PlusWelcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const w = useApi<any>("/wallet").data;
  const links = [
    { t: "Mi próxima semana", s: "Lo que viene y lo que puedes preparar", i: "calendar-range", h: "/(tabs)/agenda" },
    { t: "Asistente personal", s: "Cuéntale lo que pasó en tu consulta", i: "wand-sparkles", h: "/treatment-assistant" },
    { t: "Mis créditos", s: w ? `${money(w.available)} disponibles` : "Tu saldo para kits", i: "wallet", h: "/credits" },
    { t: "Explorar mis beneficios", s: "Descuentos, créditos y más", i: "gift", h: "/benefits" },
  ];
  return (
    <Screen back={false} title="" testID="plus-welcome-screen"
      footer={<Btn label={onboarding ? "Continuar" : "Volver a Inicio"} onPress={() => router.replace(onboarding ? "/onboarding" : "/(tabs)")} testID="plus-welcome-continue" />}>
      <View style={[styles.mark, { backgroundColor: colors.sageSoft }]}><Ic name="check" size={22} /></View>
      <Txt v="display" testID="plus-welcome-title">Ahora tienes AMODO Plus.</Txt>
      <Txt style={{ marginTop: space.xs }}>Una experiencia más personalizada, un día a la vez, a tu modo.</Txt>
      {w?.plus ? <Txt v="caption" style={{ marginTop: space.md }} testID="plus-welcome-credit">Recibiste {money(w.plus)} en créditos para tus próximos kits.</Txt> : null}
      <View style={{ marginTop: space.xl }}>
        {links.map((l, i) => <Row key={l.t} icon={l.i} tint="sand" title={l.t} subtitle={l.s} onPress={() => router.push(l.h as any)} testID={`plus-welcome-${i}`} last={i === links.length - 1} />)}
      </View>
      <Txt v="caption" style={{ marginTop: space.lg }}>Activación de demostración: no se realizó ningún cobro real.</Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginBottom: space.lg, marginTop: space.lg },
});
