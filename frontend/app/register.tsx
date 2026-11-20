import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Btn, Field, Ic, ProgressBar, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const ROLES = [
  { key: "patient", title: "Soy paciente", text: "Quiero organizar mi experiencia y personalizar mi acompañamiento.", icon: "sprout", tint: "sageSoft" },
  { key: "caregiver", title: "Soy acompañante", text: "Quiero apoyar a alguien y organizar lo que compartimos.", icon: "hand-heart", tint: "lavenderSoft" },
] as const;

const CONSENTS = [
  "Acepto los términos y el aviso de privacidad.",
  "Entiendo que AMODO no ofrece diagnósticos ni recomendaciones médicas.",
];

function Check({ checked, label, onPress, testID }: { checked: boolean; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start", paddingVertical: space.sm }}>
      <View style={[styles.box, { borderColor: checked ? colors.sage : colors.borderStrong, backgroundColor: checked ? colors.sage : colors.surfaceSecondary }]}>
        {checked ? <Ic name="check" size={14} color={colors.onBrandPrimary} /> : null}
      </View>
      <Txt style={{ flex: 1 }}>{label}</Txt>
    </Pressable>
  );
}

export default function Register() {
  const params = useLocalSearchParams<{ role?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [step, setStep] = useState(params.role ? 1 : 0);
  const [role, setRole] = useState<string>(params.role || "");
  const [f, setF] = useState({ name: "", preferred_name: "", email: "", password: "", confirm: "" });
  const [consents, setConsents] = useState([false, false]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "¿Cómo te llamas?";
    if (!/\S+@\S+\.\S+/.test(f.email)) e.email = "Escribe un correo válido.";
    if (f.password.length < 8) e.password = "Usa al menos 8 caracteres.";
    if (f.confirm !== f.password) e.confirm = "Las contraseñas no coinciden.";
    if (!consents.every(Boolean)) e.consents = "Necesitamos ambos consentimientos para continuar.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const r = await api("/auth/register", { method: "POST", body: { ...f, email: f.email.trim(), role, consents: true } });
      await signIn(r.token, r.user);
      router.replace("/choose-plan");
    } catch (err: any) {
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (step === 0)
    return (
      <Screen testID="register-role-screen" footer={<Btn label="Continuar" disabled={!role} onPress={() => setStep(1)} testID="register-role-continue-button" />}>
        <ProgressBar value={0.15} />
        <Txt v="h1" style={{ marginTop: space.xl }}>
          ¿Cómo utilizarás AMODO?
        </Txt>
        <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
          Podrás cambiar o ampliar tu rol más adelante.
        </Txt>
        {ROLES.map((r) => (
          <Pressable
            key={r.key}
            testID={`role-${r.key}-card`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setRole(r.key);
            }}
            style={[styles.role, { backgroundColor: role === r.key ? colors[r.tint] : colors.surfaceSecondary, borderColor: role === r.key ? colors.onSurface : colors.border }]}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors[r.tint] }]}>
              <Ic name={r.icon} size={24} />
            </View>
            <Txt v="h2" style={{ marginTop: space.lg }}>
              {r.title}
            </Txt>
            <Txt style={{ marginTop: 4 }}>{r.text}</Txt>
          </Pressable>
        ))}
      </Screen>
    );

  return (
    <Screen testID="register-account-screen" footer={<Btn label="Crear cuenta" loading={loading} onPress={submit} testID="register-submit-button" />}>
      <ProgressBar value={0.3} />
      <Txt v="h1" style={{ marginTop: space.xl }}>
        Tu cuenta
      </Txt>
      <Pressable onPress={() => setStep(0)} testID="register-change-role" hitSlop={8} style={{ marginTop: space.xs, marginBottom: space.xl }}>
        <Txt v="caption">
          {role === "caregiver" ? "Acompañante" : "Paciente"} · <Txt v="caption" style={{ textDecorationLine: "underline" }}>cambiar</Txt>
        </Txt>
      </Pressable>
      <Field label="Nombre" value={f.name} onChangeText={set("name")} error={errors.name} testID="register-name-input" />
      <Field label="¿Cómo prefieres que te llamemos?" value={f.preferred_name} onChangeText={set("preferred_name")} hint="Opcional" testID="register-preferred-input" />
      <Field label="Correo" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" error={errors.email} testID="register-email-input" />
      <Field label="Contraseña" value={f.password} onChangeText={set("password")} secureTextEntry error={errors.password} hint="Al menos 8 caracteres" testID="register-password-input" />
      <Field label="Confirma tu contraseña" value={f.confirm} onChangeText={set("confirm")} secureTextEntry error={errors.confirm} testID="register-confirm-input" />
      {CONSENTS.map((c, i) => (
        <Check key={c} label={c} checked={consents[i]} onPress={() => setConsents((p) => p.map((x, j) => (j === i ? !x : x)))} testID={`register-consent-${i}`} />
      ))}
      {errors.consents || errors.form ? (
        <View style={[styles.err, { backgroundColor: colors.coralSoft }]} testID="register-error">
          <Txt>{errors.consents || errors.form}</Txt>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  role: { borderRadius: radius.lg, padding: space.xl, marginBottom: space.md, borderWidth: 1.5 },
  roleIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  err: { borderRadius: radius.md, padding: space.md, marginTop: space.md },
});
