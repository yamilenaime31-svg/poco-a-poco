import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/avatar";
import { RELATIONS } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Empty, Loading, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useAuth();
  const q = useApi<any>(user && token ? `/invites/${token}` : null);
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      const l = await api(`/invites/${token}/accept`, { method: "POST", body: { relation } });
      invalidate();
      toast.show(`Ya formas parte de la red de ${l.patient_name}`);
      router.replace("/network");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <Loading />;
  return (
    <Screen title="Invitación" testID="invite-screen">
      {!user ? (
        <Empty icon="log-in" title="Inicia sesión para continuar" text="Después vuelve a abrir el enlace o escanea el QR otra vez." action="Iniciar sesión" onAction={() => router.push("/login")} testID="invite-login" />
      ) : q.isLoading ? <Loading /> : q.isError ? (
        <Empty icon="clock" title="Invitación no disponible" text={(q.error as Error).message} action="Ir a vincular" onAction={() => router.replace("/link")} testID="invite-error" />
      ) : q.data?.own ? (
        <Empty icon="user-round" title="Esta es tu propia invitación" text="Compártela con la persona que quieres vincular." testID="invite-own" />
      ) : (
        <View style={{ alignItems: "center" }}>
          <Avatar avatar={q.data.patient_avatar} name={q.data.patient_name} size={96} />
          <Txt v="h1" style={{ marginTop: space.lg, textAlign: "center" }} testID="invite-name">{q.data.patient_name} te invitó a su red</Txt>
          <Txt style={{ textAlign: "center", marginTop: space.sm, marginBottom: space.xl }}>Solo verás lo que decida compartir contigo, y podrá retirar el acceso cuando quiera.</Txt>
          <View style={{ alignSelf: "stretch" }}>
            <SingleChoice label="Tu relación (opcional)" options={RELATIONS} value={relation} onChange={setRelation} testID="invite-relation" />
            <Btn label="Aceptar invitación" icon="check" loading={busy} onPress={accept} testID="invite-accept-button" />
            <Btn label="Ahora no" variant="ghost" onPress={() => router.replace("/(tabs)")} testID="invite-decline-button" style={{ marginTop: space.sm }} />
          </View>
        </View>
      )}
    </Screen>
  );
}
