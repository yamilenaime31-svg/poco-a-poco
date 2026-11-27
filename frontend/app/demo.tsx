// Presenter tools, visible only inside the demonstration accounts: jump between the linked people and restore the original scenario.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fmtLongDate } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Loading, Row, Screen, Section, Sheet, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function Demo() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { signIn, refresh } = useAuth();
  const q = useApi<any>("/demo/people");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);

  const go = async (key: string) => {
    setBusy(key);
    try {
      const r = await api(`/demo/switch/${key}`, { method: "POST" });
      await signIn(r.token, r.user);
      invalidate();
      router.replace("/(tabs)");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy("");
    }
  };
  const reset = async () => {
    setBusy("reset");
    try {
      await api("/demo/reset", { method: "POST" });
      await refresh();
      invalidate();
      setConfirm(false);
      toast.show("Datos de demostración restablecidos");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen title="Perfil de demostración" subtitle="Datos ficticios para presentar AMODO" testID="demo-screen">
      {!q.data ? <Loading /> : (
        <>
          <Card tint="butter" style={{ borderRadius: 24 }} testID="demo-date-card">
            <Badge label="Fecha fija" tint="sand" />
            <Txt v="title" style={{ marginTop: 6, textTransform: "capitalize" }}>{fmtLongDate(q.data.date)}</Txt>
            <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>En estas cuentas «hoy» siempre es esta fecha (hora de Ciudad de México), para que las capturas sean coherentes. No se envían avisos, correos, pagos ni pedidos reales.</Txt>
          </Card>
          <Section title="Entrar como" testID="demo-people">
            {q.data.people.map((p: any, i: number) => (
              <Row key={p.key} icon={p.role === "patient" ? "user-round" : "users"} tint={p.role === "patient" ? "butter" : "sage"} title={p.name} subtitle={p.current ? `${p.relation} · cuenta actual` : p.relation} onPress={p.current ? undefined : () => go(p.key)}
                right={busy === p.key ? <Loading /> : p.current ? <Badge label="Aquí" tint="sage" /> : undefined} testID={`demo-switch-${p.key}`} last={i === q.data.people.length - 1} />
            ))}
          </Section>
          <Section title="Restablecer" testID="demo-reset-section">
            <Txt v="caption" style={{ marginBottom: space.md }}>Vuelve a dejar las cuatro cuentas de demostración como al principio. Se pierden los cambios que hayas hecho en ellas; no afecta a ninguna otra cuenta.</Txt>
            <Btn label="Restablecer datos de demostración" variant="secondary" icon="rotate-ccw" onPress={() => setConfirm(true)} testID="demo-reset-button" />
          </Section>
          <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Restablecer la demostración?" testID="demo-reset-sheet">
            <Txt style={{ marginBottom: space.lg }}>Se borran los cambios hechos en las cuentas de Sofía, Diego, Laura y Mariana y se vuelven a crear los datos originales. Tarda unos segundos.</Txt>
            <View style={{ gap: space.sm }}>
              <Btn label="Sí, restablecer" loading={busy === "reset"} onPress={reset} testID="demo-reset-confirm" />
              <Btn label="Cancelar" variant="ghost" onPress={() => setConfirm(false)} testID="demo-reset-cancel" />
            </View>
          </Sheet>
        </>
      )}
    </Screen>
  );
}
