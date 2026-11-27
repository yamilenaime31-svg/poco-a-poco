import { Company } from "@/src/art";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { Btn, Header, Logo, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const demo = async (role: string) => {
    setLoading(role);
    try {
      const r = await api("/auth/demo", { method: "POST", body: { role } });
      await signIn(r.token, r.user);
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="welcome-screen">
      <Header />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: insets.bottom + space.xl }}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Company size={96} />
          <View style={{ height: space.md }} />
          <Logo size={40} />
          <Txt v="display" style={{ marginTop: space.lg }}>
            Bienvenido a AMODO.
          </Txt>
          <Txt v="h2" color={colors.muted} style={{ marginTop: space.sm }}>
            Un día a la vez, a tu modo.
          </Txt>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150)} style={{ gap: space.sm, marginTop: space.xl }}>
          <Btn label="Crear cuenta" onPress={() => router.push("/register")} testID="welcome-register-button" />
          <Btn label="Iniciar sesión" variant="secondary" onPress={() => router.push("/login")} testID="welcome-login-button" />
          <Txt v="label" style={{ marginTop: space.md, marginBottom: space.xs }}>
            Explorar la demostración como
          </Txt>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Btn label="Paciente" variant="accent" small loading={loading === "patient"} onPress={() => demo("patient")} testID="welcome-demo-patient-button" style={{ flex: 1 }} />
            <Btn label="Acompañante" variant="secondary" small loading={loading === "caregiver"} onPress={() => demo("caregiver")} testID="welcome-demo-caregiver-button" style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
