// Everything needed to invite someone to the support network: QR, code to copy, WhatsApp and share.
import { useEffect, useRef } from "react";
import { Linking, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDateTime } from "@/src/constants";
import { inviteUrl } from "@/src/invite";
import { useToast } from "@/src/toast";
import { Btn, Loading, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

export const inviteMessage = (code?: string, url?: string) =>
  ["Te invito a mi red de apoyo en AMODO.", url ? `Abre este enlace: ${url}` : "", code ? `${url ? "O escribe" : "Escribe"} mi código en la app: ${code}` : ""].filter(Boolean).join("\n");

export const sendWhatsApp = (text: string) => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);

/** Copy / WhatsApp / share buttons for the invitation code (and link when there is one). */
export function InviteActions({ code, url, testID = "invite" }: { code?: string; url?: string; testID?: string }) {
  const toast = useToast();
  const msg = inviteMessage(code, url);
  return (
    <View style={{ gap: space.sm, alignSelf: "stretch" }}>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Btn label="Copiar código" small icon="copy" variant="secondary" disabled={!code} onPress={async () => { await Clipboard.setStringAsync(code || ""); toast.show("Código copiado"); }} testID={`${testID}-copy-code`} style={{ flex: 1 }} />
        <Btn label="Copiar mensaje" small icon="clipboard" variant="secondary" disabled={!code} onPress={async () => { await Clipboard.setStringAsync(msg); toast.show("Mensaje copiado, listo para pegar"); }} testID={`${testID}-copy-message`} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Btn label="WhatsApp" small icon="message-circle" disabled={!code} onPress={() => sendWhatsApp(msg).catch(() => toast.show("No pudimos abrir WhatsApp. Copia el mensaje y pégalo.", "error"))} testID={`${testID}-whatsapp`} style={{ flex: 1 }} />
        <Btn label="Compartir" small icon="share-2" variant="secondary" disabled={!code} onPress={() => Share.share({ message: msg }).catch(() => {})} testID={`${testID}-share`} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/** Always shows a QR: uses the active invitation or creates one when there is none. */
export function InviteCard({ code }: { code?: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const invites = useApi<any[]>("/invites");
  const creating = useRef(false);
  const current = invites.data?.[0];

  useEffect(() => {
    if (!invites.isFetched || invites.data?.length || creating.current) return;
    creating.current = true;
    api("/invites", { method: "POST" }).then(() => invalidate()).catch(() => {}).finally(() => { creating.current = false; });
  }, [invites.isFetched, invites.data]);

  const url = current ? inviteUrl(current.token) : "";
  return (
    <View style={{ backgroundColor: colors.sageSoft, borderRadius: radius.lg, padding: space.lg, alignItems: "center" }} testID="network-invite-code-card">
      <Txt v="label" style={{ alignSelf: "flex-start" }}>Invita a quien te acompaña</Txt>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginTop: space.md, minHeight: 204, minWidth: 204, alignItems: "center", justifyContent: "center" }} testID="network-qr">
        {url ? <QRCode value={url} size={180} color={colors.onSurface} backgroundColor={colors.surface} /> : <Loading />}
      </View>
      {url ? (
        <View style={{ flexDirection: "row", gap: space.sm, alignSelf: "stretch", marginTop: space.md }}>
          <Btn label="Copiar enlace" small icon="link" variant="secondary" onPress={async () => { await Clipboard.setStringAsync(url); toast.show("Enlace copiado"); }} testID="network-link-copy" style={{ flex: 1 }} />
          <Btn label="Enlace por WhatsApp" small icon="message-circle" onPress={() => sendWhatsApp(`Te invito a mi red de apoyo en AMODO. Abre este enlace: ${url}`).catch(() => toast.show("No pudimos abrir WhatsApp. Copia el enlace y pégalo.", "error"))} testID="network-link-whatsapp" style={{ flex: 1 }} />
        </View>
      ) : null}
      {current ? <Txt v="caption" style={{ marginTop: 6 }}>Este QR es para una persona y vence {fmtDateTime(current.expires_at)}. Después se genera uno nuevo.</Txt> : null}
      <Txt v="caption" style={{ marginTop: space.md }}>Tu código</Txt>
      <Txt v="display" selectable style={{ letterSpacing: 4, marginBottom: space.md }} testID="network-invite-code">{code}</Txt>
      <InviteActions code={code} url={url} testID="network-invite" />
      <Txt v="caption" style={{ marginTop: space.md, alignSelf: "flex-start" }}>Quien se una no verá nada hasta que tú compartas algo o le des permisos.</Txt>
    </View>
  );
}
