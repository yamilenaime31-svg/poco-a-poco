import { useState } from "react";
import { useRouter } from "expo-router";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { Btn, Card, Field, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function Forgot() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Escribe un correo válido.");
    setLoading(true);
    setError("");
    try {
      const r = await api("/auth/forgot", { method: "POST", body: { email: email.trim() } });
      setDemoCode(r.demo_code);
      setStep(1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (pw.length < 8) return setError("Usa al menos 8 caracteres.");
    setLoading(true);
    setError("");
    try {
      await api("/auth/reset", { method: "POST", body: { email: email.trim(), code, new_password: pw } });
      toast.show("Contraseña actualizada. Ya puedes entrar.");
      router.replace("/login");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      testID="forgot-screen"
      footer={
        step === 0 ? (
          <Btn label="Enviar código" loading={loading} onPress={send} testID="forgot-send-button" />
        ) : (
          <Btn label="Guardar nueva contraseña" loading={loading} onPress={reset} testID="forgot-reset-button" />
        )
      }
    >
      <Txt v="h1">Recuperar contraseña</Txt>
      <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
        Sin prisa. Te ayudamos a volver a entrar.
      </Txt>
      {step === 0 ? (
        <Field label="Correo de tu cuenta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} testID="forgot-email-input" />
      ) : (
        <>
          <Card tint="lavender" style={{ marginBottom: space.xl }} testID="forgot-demo-code">
            <Txt v="label" color={undefined}>
              Modo demostración
            </Txt>
            <Txt style={{ marginTop: 4 }}>
              Aún no enviamos correos reales. Tu código es: <Txt v="title">{demoCode}</Txt>
            </Txt>
          </Card>
          <Field label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} testID="forgot-code-input" />
          <Field label="Nueva contraseña" value={pw} onChangeText={setPw} secureTextEntry error={error} testID="forgot-password-input" />
        </>
      )}
    </Screen>
  );
}
