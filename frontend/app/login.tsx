import { useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Btn, Field, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError("Escribe tu correo y contraseña.");
    setLoading(true);
    setError("");
    try {
      const r = await api("/auth/login", { method: "POST", body: { email: email.trim(), password } });
      await signIn(r.token, r.user);
      router.replace(r.user.onboarding_done ? "/(tabs)" : r.user.plan_chosen ? "/onboarding" : "/choose-plan");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen testID="login-screen" footer={<Btn label="Entrar" loading={loading} onPress={submit} testID="login-submit-button" />}>
      <Txt v="h1">Qué bueno verte.</Txt>
      <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
        Entra a tu espacio.
      </Txt>
      <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="login-email-input" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry testID="login-password-input" error={error} onSubmitEditing={submit} />
      <Pressable onPress={() => router.push("/forgot")} testID="login-forgot-link" hitSlop={8}>
        <Txt v="medium" style={{ textDecorationLine: "underline" }}>
          ¿Olvidaste tu contraseña?
        </Txt>
      </Pressable>
      <Pressable onPress={() => router.replace("/register")} testID="login-register-link" style={{ marginTop: space.xl }} hitSlop={8}>
        <Txt v="caption">
          ¿Aún no tienes cuenta? <Txt v="medium">Crear cuenta</Txt>
        </Txt>
      </Pressable>
    </Screen>
  );
}
