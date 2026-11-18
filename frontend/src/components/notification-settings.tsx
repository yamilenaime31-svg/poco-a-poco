import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import * as Notifications from "expo-notifications";

import { useAuth } from "@/src/auth";
import { deviceRemindersSupported, syncDeviceReminders } from "@/src/reminders";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Field, Section, SwitchRow, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const CATS = [
  { k: "medications", l: "Medicamentos" },
  { k: "treatments", l: "Tratamientos" },
  { k: "appointments", l: "Consultas" },
  { k: "studies", l: "Estudios" },
  { k: "transfers", l: "Traslados" },
  { k: "tasks", l: "Pendientes" },
  { k: "payments", l: "Pagos" },
  { k: "personal", l: "Actividades" },
];
const LEADS = [{ v: 0, l: "Al momento" }, { v: 15, l: "15 min antes" }, { v: 60, l: "1 hora antes" }, { v: 1440, l: "1 día antes" }];
const DEFAULTS = { enabled: true, cats: {} as Record<string, boolean>, leads: [60, 1440], quiet: { start: "22:00", end: "07:00" }, discreet: true };

/** Reminder preferences + device permission flow (explain → ask → settings if blocked). */
export function NotificationSettings() {
  const { user, updateMe } = useAuth();
  const toast = useToast();
  const { colors } = useTheme();
  const n = { ...DEFAULTS, ...(user?.settings?.notif || {}) };
  const [custom, setCustom] = useState("");
  const [quiet, setQuiet] = useState(n.quiet);
  const setQ = (k: "start" | "end", v: string) => {
    const next = { ...quiet, [k]: v };
    setQuiet(next);
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) save({ quiet: next });
  };
  const [perm, setPerm] = useState<Notifications.NotificationPermissionsStatus | null>(null);

  useEffect(() => {
    if (deviceRemindersSupported) Notifications.getPermissionsAsync().then(setPerm).catch(() => {});
  }, []);

  const save = (patch: Partial<typeof n>) => updateMe({ settings: { notif: { ...n, ...patch } } }).catch((e) => toast.show(e.message, "error"));
  const toggleLead = (v: number) => save({ leads: n.leads.includes(v) ? n.leads.filter((x: number) => x !== v) : [...n.leads, v] });

  const enableDevice = async () => {
    const r = await Notifications.requestPermissionsAsync();
    setPerm(r);
    if (r.status === "granted") {
      await syncDeviceReminders().catch(() => {});
      toast.show("Listo: tu teléfono te avisará");
    }
  };

  return (
    <Section title="Notificaciones" testID="settings-notifications">
      <SwitchRow label="Recordatorios" hint="Agenda, medicamentos, traslados, pendientes y pagos" value={n.enabled} onValueChange={(v) => save({ enabled: v })} testID="settings-notif-enabled" />
      {n.enabled ? (
        <>
          <Txt v="medium" style={{ marginTop: space.lg, marginBottom: space.sm, fontSize: 14 }}>Qué avisos recibir</Txt>
          <ChipRow>
            {CATS.map((c) => <Chip key={c.k} label={c.l} selected={n.cats[c.k] !== false} onPress={() => save({ cats: { ...n.cats, [c.k]: n.cats[c.k] === false } })} testID={`settings-notif-cat-${c.k}`} />)}
          </ChipRow>
          <Txt v="medium" style={{ marginTop: space.lg, marginBottom: space.sm, fontSize: 14 }}>Cuánto tiempo antes (puedes elegir varios)</Txt>
          <ChipRow>
            {[...LEADS, ...n.leads.filter((v: number) => !LEADS.some((l) => l.v === v)).map((v: number) => ({ v, l: `${v} min antes` }))].map((l) => (
              <Chip key={l.v} label={l.l} selected={n.leads.includes(l.v)} onPress={() => toggleLead(l.v)} testID={`settings-notif-lead-${l.v}`} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start", marginTop: space.md }}>
            <View style={{ flex: 1 }}><Field value={custom} onChangeText={setCustom} placeholder="Personalizado (minutos)" keyboardType="number-pad" testID="settings-notif-custom" /></View>
            <Btn label="Agregar" small variant="secondary" disabled={!(Number(custom) > 0 && Number(custom) <= 10080)} onPress={() => { toggleLead(Number(custom)); setCustom(""); }} testID="settings-notif-custom-add" />
          </View>
          <Txt v="medium" style={{ marginBottom: space.sm, fontSize: 14 }}>Horario de silencio</Txt>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}><Field label="Desde" value={quiet.start} maxLength={5} onChangeText={(v) => setQ("start", v)} testID="settings-quiet-start" /></View>
            <View style={{ flex: 1 }}><Field label="Hasta" value={quiet.end} maxLength={5} onChangeText={(v) => setQ("end", v)} testID="settings-quiet-end" /></View>
          </View>
          <Txt v="caption" style={{ marginTop: -space.sm, marginBottom: space.md }}>En ese horario no enviamos avisos, salvo medicamentos programados.</Txt>
          <SwitchRow label="Mensajes discretos" hint="En la pantalla bloqueada solo verás «Tienes un recordatorio», sin detalles médicos" value={n.discreet} onValueChange={(v) => save({ discreet: v })} testID="settings-notif-discreet" />
        </>
      ) : null}
      <View style={{ marginTop: space.lg, padding: space.md, borderRadius: 16, backgroundColor: colors.surfaceSecondary, gap: space.sm }} testID="settings-device-notif">
        {!deviceRemindersSupported ? (
          <Txt v="caption" color={colors.onSurface}>En el navegador no podemos avisarte con la app cerrada. Verás los recordatorios en la campana de AMODO; para avisos en tu teléfono, usa la app instalada.</Txt>
        ) : perm?.status === "granted" ? (
          <Txt v="caption" color={colors.onSurface}>Avisos del teléfono activados. Se reprograman solos cuando cambias algo.</Txt>
        ) : perm && !perm.canAskAgain ? (
          <>
            <Txt v="caption" color={colors.onSurface}>Los avisos están bloqueados en tu teléfono. Puedes activarlos desde los ajustes; mientras, los verás en la campana.</Txt>
            <Btn label="Abrir ajustes" small variant="secondary" onPress={() => Linking.openSettings()} testID="settings-open-os-settings" />
          </>
        ) : (
          <>
            <Txt v="caption" color={colors.onSurface}>Activa los avisos para que tu teléfono te recuerde citas y medicamentos aunque AMODO esté cerrada.</Txt>
            <Btn label={Platform.OS === "ios" ? "Permitir avisos" : "Activar avisos"} small onPress={enableDevice} testID="settings-enable-device-notif" />
          </>
        )}
      </View>
    </Section>
  );
}
