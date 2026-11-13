import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { QUICK_REPLIES, SIGNALS, URGENCY, fmtDateTime, tintOf } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Chip, ChipRow, Empty, Field, Ic, Loading, Screen, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

function SignalCard({ s, received, onChanged }: { s: any; received?: boolean; onChanged: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [custom, setCustom] = useState("");
  const def = SIGNALS.find((x) => x.type === s.type);
  const respond = async (text: string) => {
    try {
      await api(`/signals/${s.id}/respond`, { method: "POST", body: { text } });
      toast.show("Respuesta enviada");
      setCustom("");
      onChanged();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const close = async () => {
    await api(`/signals/${s.id}/close`, { method: "POST" });
    onChanged();
  };
  return (
    <Card style={{ marginBottom: space.md }} testID={`signal-card-${s.id}`}>
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <View style={[styles.icon, { backgroundColor: tintOf(colors, def?.tint).bg }]}>
          <Ic name={def?.icon || "bell"} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="title">{received ? `${s.patient_name}: ${s.label}` : s.label}</Txt>
          <Txt v="caption">
            {s.urgency} · {fmtDateTime(s.created_at)}
          </Txt>
        </View>
        <Badge label={s.status === "enviada" ? "Enviada" : s.status === "atendida" ? "Atendida" : "Resuelta"} tint={s.status === "enviada" ? "coral" : "sage"} testID={`signal-status-${s.id}`} />
      </View>
      {s.message ? <Txt style={{ marginTop: space.md }}>{s.message}</Txt> : null}
      {s.responses?.map((r: any, i: number) => (
        <View key={i} style={[styles.reply, { backgroundColor: colors.surface }]}>
          <Txt v="caption">
            {r.name} · {fmtDateTime(r.at)}
          </Txt>
          <Txt>{r.text}</Txt>
        </View>
      ))}
      {received && s.status !== "resuelta" ? (
        <View style={{ marginTop: space.md }}>
          <ChipRow>
            {QUICK_REPLIES.map((q) => (
              <Chip key={q} label={q} onPress={() => respond(q)} testID={`signal-reply-${s.id}-${q}`} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <View style={{ flex: 1 }}>
              <Field value={custom} onChangeText={setCustom} placeholder="Escribe una respuesta" testID={`signal-custom-${s.id}`} style={{ marginBottom: -space.lg }} />
            </View>
            <Btn label="Enviar" small disabled={!custom.trim()} onPress={() => respond(custom.trim())} testID={`signal-custom-send-${s.id}`} />
          </View>
        </View>
      ) : null}
      {!received && s.status !== "resuelta" ? <Btn label="Marcar como resuelta" variant="secondary" small onPress={close} testID={`signal-close-${s.id}`} style={{ alignSelf: "flex-start", marginTop: space.sm }} /> : null}
    </Card>
  );
}

export default function Signals() {
  const params = useLocalSearchParams<{ type?: string; message?: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const isCg = user?.role === "caregiver";
  const [type, setType] = useState(params.type || "");
  const [message, setMessage] = useState(params.message || "");
  const [urgency, setUrgency] = useState("Cuando puedas");
  const [sending, setSending] = useState(false);
  const sent = useApi<any[]>(isCg ? null : "/signals?box=sent");
  const received = useApi<any[]>("/signals?box=received");
  const def = SIGNALS.find((s) => s.type === type);

  const send = async () => {
    if (!def) return;
    setSending(true);
    try {
      const r = await api("/signals", { method: "POST", body: { type, label: def.label, message, urgency } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(r.recipients ? `Enviada a ${r.recipients} persona(s) de tu red` : "Guardada. Aún no tienes acompañantes vinculados.");
      setType("");
      setMessage("");
      invalidate();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSending(false);
    }
  };

  const reload = () => {
    invalidate();
  };

  return (
    <Screen title={isCg ? "Solicitudes recibidas" : "Señales rápidas"} testID="signals-screen" refreshing={received.isRefetching} onRefresh={reload}>
      {!isCg ? (
        <>
          <Txt v="caption">Comunica una necesidad con un toque. Tu red la recibe al instante.</Txt>
          <View style={styles.grid}>
            {SIGNALS.map((s) => (
              <Pressable
                key={s.type}
                testID={`signal-type-${s.type}`}
                onPress={() => setType(type === s.type ? "" : s.type)}
                style={({ pressed }) => [styles.tile, { backgroundColor: tintOf(colors, s.tint).bg, borderColor: type === s.type ? colors.onSurface : "transparent", transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              >
                <Ic name={s.icon} size={22} />
                <Txt v="medium" style={{ fontSize: 14 }}>
                  {s.label}
                </Txt>
              </Pressable>
            ))}
          </View>
          {def ? (
            <Card style={{ marginTop: space.lg }} testID="signal-compose">
              <Txt v="title" style={{ marginBottom: space.md }}>
                {def.label}
              </Txt>
              <SingleChoice label="¿Para cuándo?" options={URGENCY} value={urgency} onChange={(v) => setUrgency(v || "Cuando puedas")} testID="signal-urgency" />
              <Field label="Mensaje (opcional)" value={message} onChangeText={setMessage} multiline placeholder="Agrega detalles si quieres" testID="signal-message-input" />
              <Btn label="Enviar señal" icon="send" loading={sending} onPress={send} testID="signal-send-button" />
            </Card>
          ) : null}
          <Section title="Historial de señales" testID="signals-history">
            {sent.isLoading ? <Loading /> : (sent.data || []).length === 0 ? <Empty icon="radio" title="Sin señales enviadas" text="Cuando envíes una, verás aquí las respuestas de tu red." /> : sent.data!.map((s) => <SignalCard key={s.id} s={s} onChanged={reload} />)}
          </Section>
          {(received.data || []).length ? (
            <Section title="Recibidas de personas que acompañas">
              {received.data!.map((s) => <SignalCard key={s.id} s={s} received onChanged={reload} />)}
            </Section>
          ) : null}
        </>
      ) : received.isLoading ? <Loading /> : (received.data || []).length === 0 ? (
        <Empty icon="inbox" title="Sin solicitudes" text="Cuando alguien que acompañas envíe una señal, aparecerá aquí." testID="signals-empty" />
      ) : (
        received.data!.map((s) => <SignalCard key={s.id} s={s} received onChanged={reload} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  tile: { width: "48.6%", height: 96, borderRadius: radius.md, padding: space.md, justifyContent: "space-between", borderWidth: 1.5 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  reply: { marginTop: space.sm, borderRadius: radius.sm, padding: space.md },
});
