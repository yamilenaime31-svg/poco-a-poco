import { Spot } from "@/src/art";
import { useState } from "react";
import { Share, View } from "react-native";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/avatar";
import { RELATIONS, SHARE_KEYS } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Empty, Field, Loading, Row, Screen, Section, SwitchRow, Txt } from "@/src/ui";
import { space } from "@/src/theme";

function LinkCard({ l, asPatient }: { l: any; asPatient: boolean }) {
  const toast = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const name = asPatient ? l.caregiver_name : l.patient_name;
  const canAccept = (l.status === "pending_patient" && asPatient) || (l.status === "pending_caregiver" && !asPatient);
  const statusLabel = l.status === "active" ? "Activo" : canAccept ? "Por responder" : "Pendiente";
  const act = async (path: string, method = "POST", body?: any, msg?: string) => {
    try {
      await api(path, { method, body });
      invalidate();
      if (msg) toast.show(msg);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  return (
    <Card style={{ marginBottom: space.md }} testID={`link-card-${l.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar avatar={asPatient ? l.caregiver_avatar : l.patient_avatar} name={name} size={48} testID={`link-avatar-${l.id}`} />
        <View style={{ flex: 1 }}>
          <Row title={name || "Invitación"} subtitle={[l.relation, l.caregiver_email && asPatient ? l.caregiver_email : null].filter(Boolean).join(" · ")} right={<Badge label={statusLabel} tint={l.status === "active" ? "sage" : "coral"} />} last />
        </View>
      </View>
      {canAccept ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Btn label="Rechazar" variant="ghost" small onPress={() => act(`/network/${l.id}`, "DELETE", undefined, "Solicitud rechazada")} testID={`link-decline-${l.id}`} style={{ flex: 1 }} />
          <Btn label="Aceptar" small onPress={() => act(`/network/${l.id}/accept`, "POST", undefined, "Vínculo activo")} testID={`link-accept-${l.id}`} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {asPatient && l.status === "active" ? <Btn label={open ? "Ocultar permisos" : "Permisos"} variant="secondary" small icon="shield-check" onPress={() => setOpen(!open)} testID={`link-perms-toggle-${l.id}`} style={{ flex: 1 }} /> : null}
          <Btn label={l.status === "active" ? "Quitar" : "Cancelar"} variant="ghost" small onPress={() => act(`/network/${l.id}`, "DELETE", undefined, "Vínculo eliminado")} testID={`link-remove-${l.id}`} style={{ flex: 1 }} />
        </View>
      )}
      {open ? (
        <View style={{ marginTop: space.md }}>
          <Txt v="caption">Elige qué puede ver {name}.</Txt>
          {SHARE_KEYS.map((s) => (
            <SwitchRow key={s.key} label={s.label} value={!!(l.permissions?.[s.key] ?? s.key === "signals")} onValueChange={(v) => act(`/network/${l.id}/permissions`, "PUT", { [s.key]: v })} testID={`perm-${l.id}-${s.key}`} />
          ))}
        </View>
      ) : null}
      {!asPatient && l.status === "active" && user ? (
        <Txt v="caption" style={{ marginTop: space.sm }}>
          Solo ves lo que {l.patient_name} decida compartir contigo, elemento por elemento.{l.permissions?.signals === false ? "" : " Recibes sus señales rápidas."}
        </Txt>
      ) : null}
    </Card>
  );
}

export default function Network() {
  const { user } = useAuth();
  const toast = useToast();
  const isCg = user?.role === "caregiver";
  const q = useApi<any>("/network");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (path: string, body: any, msg: string) => {
    setBusy(true);
    try {
      await api(path, { method: "POST", body });
      invalidate();
      toast.show(msg);
      setCode("");
      setEmail("");
      setName("");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const d = q.data;
  return (
    <Screen title={isCg ? "Personas vinculadas" : "Mi red de apoyo"} testID="network-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : (
        <>
          {!isCg ? (
            <>
              <Card tint="sage" style={{ borderRadius: 24, overflow: "hidden" }} testID="network-invite-code-card">
                <View style={{ position: "absolute", right: 10, top: 10 }} pointerEvents="none"><Spot name="network" size={76} /></View>
                <Txt v="label">Tu código de invitación</Txt>
                <Txt v="display" style={{ letterSpacing: 4, marginVertical: space.sm }} testID="network-invite-code">
                  {d.invite_code}
                </Txt>
                <Txt v="caption">Quien lo use se unirá a tu red con los permisos que definiste por defecto.</Txt>
                <Btn label="Compartir código" small icon="share-2" onPress={() => Share.share({ message: `Únete a mi red en AMODO con el código ${d.invite_code}` })} testID="network-share-code-button" style={{ alignSelf: "flex-start", marginTop: space.md }} />
              </Card>
              <Section title="Invitar por correo">
                <Field label="Nombre" value={name} onChangeText={setName} testID="network-invite-name-input" />
                <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="network-invite-email-input" />
                <SingleChoice label="Relación" options={RELATIONS} value={relation} onChange={setRelation} testID="network-invite-relation" />
                <Btn label="Enviar invitación" icon="user-plus" loading={busy} disabled={!email} onPress={() => run("/network/invite", { email, name, relation }, "Invitación enviada")} testID="network-invite-button" />
              </Section>
              <Section title="Acompañantes" testID="network-caregivers">
                {d.as_patient.length === 0 ? <Empty icon="users" title="Aún no hay nadie en tu red" text="Invita a quien quieras, cuando quieras." /> : d.as_patient.map((l: any) => <LinkCard key={l.id} l={l} asPatient />)}
              </Section>
            </>
          ) : null}
          {isCg || d.as_caregiver.length ? (
            <>
              {isCg ? (
                <Card tint="lavender" style={{ borderRadius: 24 }}>
                  <Spot name="network" size={56} />
                  <Txt v="h2" style={{ marginTop: space.sm }}>Vincúlate con quien acompañas</Txt>
                  <Field label="Código de invitación" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} testID="network-join-code-input" style={{ marginTop: space.sm }} />
                  <Btn label="Vincularme con código" icon="link" loading={busy} disabled={code.length < 6} onPress={() => run("/network/join", { code }, "Ya formas parte de su red")} testID="network-join-button" />
                  <Txt v="caption" style={{ marginVertical: space.lg, textAlign: "center" }}>
                    o envía una solicitud
                  </Txt>
                  <Field label="Correo de la persona" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="network-request-email-input" />
                  <Btn label="Enviar solicitud" variant="secondary" icon="send" loading={busy} disabled={!email} onPress={() => run("/network/request", { email }, "Solicitud enviada. La persona decide si acepta.")} testID="network-request-button" />
                </Card>
              ) : null}
              <Section title={isCg ? "Personas que acompañas" : "Personas que acompañas tú"} testID="network-patients">
                {d.as_caregiver.length === 0 ? <Empty icon="link" title="Sin vínculos todavía" text="Cuando te vincules, verás aquí a cada persona y lo que comparte contigo." /> : d.as_caregiver.map((l: any) => <LinkCard key={l.id} l={l} asPatient={false} />)}
              </Section>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
