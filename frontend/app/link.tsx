import { useCallback, useEffect, useState } from "react";
import { Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fmtDateTime } from "@/src/constants";
import { inviteUrl, tokenFrom } from "@/src/invite";
import { useToast } from "@/src/toast";
import { Btn, Card, Field, Ic, Loading, Row, Screen, Section, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";


export default function LinkScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isPatient = user?.role !== "caregiver";
  const invites = useApi<any[]>(isPatient ? "/invites" : null);
  const [current, setCurrent] = useState<any>(null);
  const [paste, setPaste] = useState("");
  const [code, setCode] = useState("");

  const create = useCallback(async () => {
    try {
      const i = await api("/invites", { method: "POST" });
      setCurrent(i);
      invalidate();
      toast.show("Tu invitación está lista para compartir");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  }, [toast]);

  useEffect(() => {
    if (!isPatient || current || !invites.isFetched) return;
    if (invites.data?.length) setCurrent(invites.data[0]);
    else create();
  }, [isPatient, current, create, invites.isFetched, invites.data]);

  const url = current ? inviteUrl(current.token) : "";
  const cancel = async (token: string) => {
    await api(`/invites/${token}`, { method: "DELETE" });
    if (current?.token === token) setCurrent(null);
    invalidate();
    toast.show("Invitación cancelada");
  };
  const join = async () => {
    try {
      const l = await api("/network/join", { method: "POST", body: { code } });
      invalidate();
      toast.show(`Te vinculaste con ${l.patient_name}`);
      setCode("");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  return (
    <Screen title="Vincular" testID="link-screen">
      {isPatient ? (
        <>
          <Txt v="h1">Invita a quien te acompaña</Txt>
          <Txt v="caption" style={{ marginTop: 4, marginBottom: space.xl }}>Cada invitación es para una persona, dura 48 horas y no contiene información tuya. Al vincularse no verá nada hasta que tú compartas algo.</Txt>
          <View style={{ alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: space.xl }} testID="link-qr-card">
            {current ? <QRCode value={url} size={200} color={colors.onSurface} backgroundColor={colors.surfaceSecondary} /> : <Loading />}
            {current ? <Txt v="caption" style={{ marginTop: space.md }}>Vence: {fmtDateTime(current.expires_at)}</Txt> : null}
          </View>
          <Txt v="medium" style={{ marginTop: space.xl, marginBottom: space.sm }}>También puedes compartir este enlace</Txt>
          <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: colors.border }}>
            <Txt v="caption" numberOfLines={2} selectable testID="link-url">{url || "Generando…"}</Txt>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <Btn label="Copiar enlace" icon="copy" variant="secondary" disabled={!url} onPress={async () => { await Clipboard.setStringAsync(url); toast.show("Enlace copiado"); }} testID="link-copy-button" style={{ flex: 1 }} />
            <Btn label="Compartir" icon="share-2" disabled={!url} onPress={() => Share.share({ message: `Te invito a mi red de apoyo en AMODO: ${url}` })} testID="link-share-button" style={{ flex: 1 }} />
          </View>
          <Btn label="Crear invitación para otra persona" variant="ghost" icon="user-plus" onPress={create} testID="link-new-button" style={{ marginTop: space.sm }} />
          <Card tint="sage" style={{ marginTop: space.lg }}>
            <Txt v="label" color={colors.onSurface}>Código manual</Txt>
            <Txt v="h1" style={{ letterSpacing: 4, marginTop: 4 }} testID="link-manual-code">{user?.invite_code}</Txt>
          </Card>
          <Section title="Invitaciones activas" testID="link-invites">
            {(invites.data || []).length === 0 ? <Txt v="caption">No hay invitaciones activas.</Txt> : invites.data!.map((i, k) => (
              <Row key={i.token} icon="ticket" tint="butter" title={`Invitación ${k + 1}`} subtitle={`Vence ${fmtDateTime(i.expires_at)}`} right={<Btn label="Cancelar" small variant="ghost" onPress={() => cancel(i.token)} testID={`link-cancel-${k}`} />} last={k === invites.data!.length - 1} />
            ))}
          </Section>
          <Btn label="Ver mi red y permisos" variant="secondary" icon="users" onPress={() => router.push("/network")} testID="link-network-button" style={{ marginTop: space.lg }} />
        </>
      ) : null}
      <Section title={isPatient ? "¿Alguien te invitó a ti?" : "Vincúlate con quien acompañas"} testID="link-caregiver">
        <Btn label="Escanear QR" icon="scan-line" onPress={() => router.push("/scan")} testID="link-scan-button" />
        <Field label="Abrir enlace de invitación" value={paste} onChangeText={setPaste} placeholder="Pega aquí el enlace" autoCapitalize="none" testID="link-paste-input" style={{ marginTop: space.lg }} />
        <Btn label="Abrir invitación" variant="secondary" icon="link" disabled={!tokenFrom(paste)} onPress={() => router.push({ pathname: "/invite", params: { token: tokenFrom(paste) } })} testID="link-open-button" />
        <Field label="Código manual" value={code} onChangeText={(v) => setCode(v.toUpperCase())} maxLength={6} autoCapitalize="characters" placeholder="Ej. K7P2QX" testID="link-code-input" style={{ marginTop: space.lg }} />
        <Btn label="Vincularme con código" variant="secondary" icon="key-round" disabled={code.length < 6} onPress={join} testID="link-code-button" />
        <View style={{ flexDirection: "row", gap: 6, marginTop: space.md }}><Ic name="info" size={14} /><Txt v="caption" style={{ flex: 1 }}>Si no tienes cámara o permisos, usa el enlace o el código.</Txt></View>
      </Section>
    </Screen>
  );
}
