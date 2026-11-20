import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fmtDate } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Card, Field, Ic, Screen, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function Redeem() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const toast = useToast();
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [freeBusy, setFreeBusy] = useState(false);
  const { refresh } = useAuth();
  const continueFree = async () => {
    setFreeBusy(true);
    setError("");
    try {
      await api("/me/plan", { method: "POST", body: { action: "free" } });
      await refresh();
      router.replace("/onboarding");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFreeBusy(false);
    }
  };

  const validate = async () => {
    setBusy(true);
    setError("");
    try {
      setInfo(await api("/benefits/validate", { method: "POST", body: { code } }));
    } catch (e: any) {
      setInfo(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const activate = async () => {
    setBusy(true);
    try {
      await api("/benefits/activate", { method: "POST", body: { code } });
      invalidate();
      await refresh();
      toast.show("Beneficios activados");
      router.replace(onboarding ? "/onboarding" : "/plan");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Activa tus beneficios" subtitle="Ingresa el código que te proporcionó tu hospital, asociación o institución" testID="redeem-screen">
      <Field label="Código de acceso" value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setInfo(null); setError(""); }} autoCapitalize="characters" placeholder="Ej. HOSPITAL-DEMO" error={error} testID="redeem-input" />
      {!info ? <Btn label="Validar código" loading={busy} disabled={code.trim().length < 3} onPress={validate} testID="redeem-validate" /> : (
        <>
          <Card tint="sage" testID="redeem-info">
            <Txt v="caption" color={colors.onSurface}>{info.institution_type}</Txt>
            <Txt v="title">{info.institution} te ofrece:</Txt>
            {info.benefits.map((b: string) => (
              <View key={b} style={{ flexDirection: "row", gap: 6, marginTop: 6 }}><Ic name="check" size={14} /><Txt style={{ flex: 1 }}>{b}</Txt></View>
            ))}
            <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.md }}>Vigencia hasta {fmtDate(info.valid_until)}. {info.conditions}</Txt>
          </Card>
          <View style={{ flexDirection: "row", gap: 6, marginVertical: space.md }}>
            <Ic name="shield-check" size={14} color={colors.muted} />
            <Txt v="caption" style={{ flex: 1 }}>{info.privacy} Activar un código no da acceso clínico a nadie.</Txt>
          </View>
          <Btn label="Activar beneficios" icon="check" loading={busy} onPress={activate} testID="redeem-activate" />
        </>
      )}
      {onboarding ? (
        <Btn label="Continuar con AMODO Gratis" variant="ghost" loading={freeBusy} onPress={continueFree} testID="redeem-continue-free" style={{ marginTop: space.md }} />
      ) : null}
    </Screen>
  );
}
