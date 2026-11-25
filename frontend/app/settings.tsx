import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { NotificationSettings } from "@/src/components/notification-settings";
import { SHARE_KEYS } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Chip, ChipRow, Row, Screen, Section, SwitchRow, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const SCALES = [
  { label: "Normal", v: 1 },
  { label: "Grande", v: 1.15 },
  { label: "Muy grande", v: 1.3 },
];

export default function Settings() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, updateMe } = useAuth();
  const s = user?.settings || {};
  const [share, setShare] = useState<Record<string, boolean>>({ events: true, tasks: true, transfers: true, edit: true, ...(user?.profile?.privacy?.share || {}) });

  const setSetting = async (k: string, v: any) => {
    try {
      await updateMe({ settings: { [k]: v } });
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const setShareKey = async (k: string, v: boolean) => {
    const next = { ...share, [k]: v };
    setShare(next);
    await updateMe({ profile: { privacy: { share: next } } }).catch((e) => toast.show(e.message, "error"));
  };

  const privacy = (
    <Section title="Privacidad y permisos" testID="settings-privacy" style={section === "privacy" ? { marginTop: space.sm } : undefined}>
      <Txt v="caption" style={{ marginBottom: space.sm }}>
        {user?.role === "caregiver" ? "Como acompañante, ves solo lo que cada persona comparte contigo." : "Permisos por defecto para nuevos acompañantes. Ajusta cada persona desde Mi red de apoyo."}
      </Txt>
      {user?.role !== "caregiver" ? SHARE_KEYS.map((k) => <SwitchRow key={k.key} label={k.label} value={!!share[k.key]} onValueChange={(v) => setShareKey(k.key, v)} testID={`settings-share-${k.key}`} />) : null}
      <Row icon="users" title="Permisos por persona" onPress={() => router.push("/network")} testID="settings-network-link" last />
    </Section>
  );

  return (
    <Screen title={section === "privacy" ? "Privacidad y permisos" : "Configuración"} testID="settings-screen">
      {section === "privacy" ? privacy : null}
      <Section title="Accesibilidad" testID="settings-accessibility" style={{ marginTop: section === "privacy" ? space.xxl : space.sm }}>
        <Txt v="medium" style={{ marginBottom: space.sm }}>
          Tamaño del texto
        </Txt>
        <ChipRow>
          {SCALES.map((x) => (
            <Chip key={x.label} label={x.label} selected={Number(s.text_scale || 1) === x.v} onPress={() => setSetting("text_scale", x.v)} testID={`settings-text-${x.label}`} />
          ))}
        </ChipRow>
        <Txt style={{ marginTop: space.md }}>Así se verá el texto en AMODO.</Txt>
        <SwitchRow label="Desactivar animaciones de las ilustraciones" value={!!s.reduce_motion} onValueChange={(v) => setSetting("reduce_motion", v)} testID="settings-reduce-motion" />
      </Section>
      <NotificationSettings />
      <Section title="Otros avisos">
        <SwitchRow label="Señales y respuestas" value={s.notif_signals !== false} onValueChange={(v) => setSetting("notif_signals", v)} testID="settings-notif-signals" />
        <SwitchRow label="Estado de pedidos" value={s.notif_orders !== false} onValueChange={(v) => setSetting("notif_orders", v)} testID="settings-notif-orders" />
      </Section>
      {section !== "privacy" ? privacy : null}
      <Section title="Cuenta">
        <Row icon="user-round" title="Perfil y preferencias" onPress={() => router.push({ pathname: "/onboarding", params: { edit: "1", step: user?.role === "caregiver" ? "about" : "tastes" } })} testID="settings-preferences-link" />
        <Row icon="circle-help" title="Ayuda" onPress={() => router.push({ pathname: "/info/[page]", params: { page: "help" } })} testID="settings-help-link" />
        <Row icon="file-text" title="Términos y privacidad" onPress={() => router.push({ pathname: "/info/[page]", params: { page: "privacy" } })} testID="settings-privacy-link" last />
      </Section>
    </Screen>
  );
}
