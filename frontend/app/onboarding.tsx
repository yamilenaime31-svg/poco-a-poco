import { useState } from "react";
import { Share, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ASK_WAYS, CAREGIVER_SUPPORT, NEEDS, PATIENT_TASTES, RELATIONS, SHARE_KEYS } from "@/src/constants";
import { DateField, MultiChoice, SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Card, Field, Ic, ProgressBar, Row, Screen, SwitchRow, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const TREAT_TYPES = ["Quimioterapia", "Radioterapia", "Inmunoterapia", "Cirugía", "Terapia dirigida", "Terapia hormonal", "Otro"];
const TREAT_FLAGS = ["Todavía no lo sé", "Prefiero agregarlo después", "Mi calendario cambia"];

export default function Onboarding() {
  const { user, updateMe } = useAuth();
  const params = useLocalSearchParams<{ edit?: string; step?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const isPatient = user?.role !== "caregiver";
  const steps = isPatient ? ["treatment", "tastes", "needs", "companions", "privacy", "done"] : ["about", "companions", "privacy", "done"];
  const editing = params.edit === "1";
  const [i, setI] = useState(Math.max(0, steps.indexOf(params.step || "")));
  const step = steps[i];
  const p = user?.profile || {};
  const [treatment, setTreatment] = useState<Record<string, any>>({ types: [], flags: [], ...(p.treatment || {}) });
  const [tastes, setTastes] = useState<Record<string, any>>({ activities: [], objects: [], comfort: [], colors: [], styles: [], dislikes: [], ...(p.tastes || {}) });
  const [needs, setNeeds] = useState<Record<string, any>>({ support: [], ask: [], note: "", ...(p.needs || {}) });
  const [about, setAbout] = useState<Record<string, any>>({ relation: "", support: [], ...(p.about || {}) });
  const [share, setShare] = useState<Record<string, boolean>>({ events: true, tasks: true, transfers: true, expenses: false, treatments: false, medications: false, journal: false, edit: true, ...(p.privacy?.share || {}) });
  const [inv, setInv] = useState({ name: "", email: "", relation: "" });
  const [code, setCode] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const saveStep = async () => {
    if (step === "treatment") {
      await updateMe({ profile: { treatment } });
      if (!editing && !p.treatment) {
        for (const t of treatment.types)
          await api("/records/treatments", { method: "POST", body: { name: t, status: treatment.status, date: treatment.start, frequency: treatment.frequency, next_session: treatment.next, center: treatment.center, notes: treatment.notes } });
        if (treatment.next) await api("/records/events", { method: "POST", body: { title: "Próxima sesión", type: "Sesión de tratamiento", date: treatment.next, location: treatment.center } });
      }
    }
    if (step === "tastes") await updateMe({ profile: { tastes } });
    if (step === "needs") await updateMe({ profile: { needs } });
    if (step === "about") await updateMe({ profile: { about } });
    if (step === "privacy") await updateMe({ profile: { privacy: { share } } });
  };

  const next = async (skip = false) => {
    setSaving(true);
    try {
      if (!skip) await saveStep();
      if (editing && step !== "done") {
        toast.show("Preferencias guardadas");
        router.back();
        return;
      }
      if (step === "done") {
        await updateMe({ onboarding_done: true });
        router.replace("/(tabs)");
        return;
      }
      setI(i + 1);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    try {
      await api("/network/invite", { method: "POST", body: inv });
      setInvited((x) => [...x, inv.name || inv.email]);
      setInv({ name: "", email: "", relation: "" });
      toast.show("Invitación guardada");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const join = async () => {
    try {
      const l = await api("/network/join", { method: "POST", body: { code, relation: about.relation } });
      setInvited((x) => [...x, l.patient_name]);
      setCode("");
      toast.show(`Te vinculaste con ${l.patient_name}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const footer = (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {step !== "done" && !editing ? <Btn label="Completar después" variant="ghost" onPress={() => next(true)} testID="onboarding-skip-button" style={{ flex: 1 }} /> : null}
      <Btn label={step === "done" ? "Ir a mi inicio" : editing ? "Guardar" : "Continuar"} loading={saving} onPress={() => next()} testID="onboarding-next-button" style={{ flex: 1 }} />
    </View>
  );

  return (
    <Screen back={editing || i > 0} testID={`onboarding-${step}-screen`} footer={footer}>
      {!editing ? <ProgressBar value={(i + 1) / steps.length} /> : null}
      <Animated.View key={step} entering={FadeIn.duration(300)} style={{ marginTop: space.xl }}>
        {step === "treatment" && (
          <>
            <Txt v="h1">Cuéntanos un poco sobre tu proceso.</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Puedes completar esto ahora o más adelante. No calculamos ni asumimos fechas.
            </Txt>
            <MultiChoice label="Tipo de tratamiento" options={TREAT_TYPES} value={treatment.types} onChange={(v) => setTreatment({ ...treatment, types: v })} testID="treat-type" />
            <SingleChoice label="Estado" options={["Por comenzar", "En curso", "En pausa", "Finalizado"]} value={treatment.status} onChange={(v) => setTreatment({ ...treatment, status: v })} testID="treat-status" />
            <DateField label="Fecha de inicio" value={treatment.start || ""} onChange={(v) => setTreatment({ ...treatment, start: v })} testID="treat-start" />
            <Field label="Frecuencia o ciclos (si aplica)" value={treatment.frequency || ""} onChangeText={(v) => setTreatment({ ...treatment, frequency: v })} placeholder="Ej. Cada 21 días, 6 ciclos" testID="treat-frequency-input" />
            <DateField label="Próxima sesión" value={treatment.next || ""} onChange={(v) => setTreatment({ ...treatment, next: v })} testID="treat-next" />
            <Field label="Hospital o centro" value={treatment.center || ""} onChangeText={(v) => setTreatment({ ...treatment, center: v })} testID="treat-center-input" />
            <Field label="Notas (opcional)" value={treatment.notes || ""} onChangeText={(v) => setTreatment({ ...treatment, notes: v })} multiline testID="treat-notes-input" />
            <MultiChoice options={TREAT_FLAGS} value={treatment.flags} onChange={(v) => setTreatment({ ...treatment, flags: v })} testID="treat-flag" />
          </>
        )}
        {step === "tastes" && (
          <>
            <Txt v="h1">Queremos conocerte más allá de tu tratamiento.</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Elige lo que quieras. Esto nos ayuda a sugerirte kits a tu modo.
            </Txt>
            <MultiChoice label="¿Qué actividades disfrutas?" options={PATIENT_TASTES.activities} value={tastes.activities} onChange={(v) => setTastes({ ...tastes, activities: v })} testID="taste-activity" allowCustom />
            <MultiChoice label="¿Qué objetos sueles llevar contigo?" options={PATIENT_TASTES.objects} value={tastes.objects} onChange={(v) => setTastes({ ...tastes, objects: v })} testID="taste-object" allowCustom />
            <MultiChoice label="¿Qué te hace sentir cómodo/a?" options={PATIENT_TASTES.comfort} value={tastes.comfort} onChange={(v) => setTastes({ ...tastes, comfort: v })} testID="taste-comfort" allowCustom />
            <MultiChoice label="Colores que prefieres" options={PATIENT_TASTES.colors} value={tastes.colors} onChange={(v) => setTastes({ ...tastes, colors: v })} testID="taste-color" />
            <MultiChoice label="Estilos" options={PATIENT_TASTES.styles} value={tastes.styles} onChange={(v) => setTastes({ ...tastes, styles: v })} testID="taste-style" />
            <MultiChoice label="¿Qué artículos o cosas no te gustan?" options={PATIENT_TASTES.dislikes} value={tastes.dislikes} onChange={(v) => setTastes({ ...tastes, dislikes: v })} testID="taste-dislike" allowCustom />
          </>
        )}
        {step === "needs" && (
          <>
            <Txt v="h1">¿En qué te vendría bien apoyo?</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Todo es opcional y puede cambiar con los días.
            </Txt>
            <MultiChoice label="Necesito apoyo para…" options={NEEDS} value={needs.support} onChange={(v) => setNeeds({ ...needs, support: v })} testID="need-support" allowCustom />
            <MultiChoice label="¿Cómo prefieres pedir ayuda?" options={ASK_WAYS} value={needs.ask} onChange={(v) => setNeeds({ ...needs, ask: v })} testID="need-ask" />
            <Field label="Algo más que quieras que sepamos" value={needs.note} onChangeText={(v) => setNeeds({ ...needs, note: v })} multiline testID="need-note-input" />
          </>
        )}
        {step === "about" && (
          <>
            <Txt v="h1">Gracias por acompañar.</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Cuéntanos cómo te gustaría ayudar. Podrás ajustarlo después.
            </Txt>
            <SingleChoice label="Tu relación con la persona" options={RELATIONS} value={about.relation} onChange={(v) => setAbout({ ...about, relation: v })} testID="about-relation" />
            <MultiChoice label="¿Con qué puedes apoyar?" options={CAREGIVER_SUPPORT} value={about.support} onChange={(v) => setAbout({ ...about, support: v })} testID="about-support" allowCustom />
          </>
        )}
        {step === "companions" && isPatient && (
          <>
            <Txt v="h1">Tu red de apoyo</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Comparte tu código o invita por correo. Tú decides qué ve cada persona.
            </Txt>
            <Card tint="sage" testID="onboarding-invite-code">
              <Txt v="label" color={colors.onSurface}>
                Tu código de invitación
              </Txt>
              <Txt v="display" style={{ letterSpacing: 4, marginVertical: space.sm }}>
                {user?.invite_code}
              </Txt>
              <Btn label="Compartir código" icon="share-2" small variant="secondary" onPress={() => Share.share({ message: `Únete a mi red en AMODO con el código ${user?.invite_code}` })} testID="onboarding-share-code-button" style={{ alignSelf: "flex-start" }} />
            </Card>
            <Txt v="title" style={{ marginTop: space.xl, marginBottom: space.md }}>
              Invitar por correo
            </Txt>
            <Field label="Nombre" value={inv.name} onChangeText={(v) => setInv({ ...inv, name: v })} testID="invite-name-input" />
            <Field label="Correo" value={inv.email} onChangeText={(v) => setInv({ ...inv, email: v })} autoCapitalize="none" keyboardType="email-address" testID="invite-email-input" />
            <SingleChoice label="Relación" options={RELATIONS} value={inv.relation} onChange={(v) => setInv({ ...inv, relation: v })} testID="invite-relation" />
            <Btn label="Agregar invitación" variant="secondary" icon="user-plus" disabled={!inv.email} onPress={invite} testID="invite-add-button" />
          </>
        )}
        {step === "companions" && !isPatient && (
          <>
            <Txt v="h1">Vincúlate con quien acompañas</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Pídele su código de AMODO. También puedes enviar una solicitud por correo desde Personas vinculadas.
            </Txt>
            <Field label="Código de invitación" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} testID="join-code-input" />
            <Btn label="Vincularme" variant="secondary" icon="link" disabled={code.length < 6} onPress={join} testID="join-code-button" />
          </>
        )}
        {step === "companions" && invited.length > 0 && (
          <View style={{ marginTop: space.xl }}>
            {invited.map((n, k) => (
              <Row key={k} icon="check" title={n} subtitle={isPatient ? "Invitación pendiente" : "Vinculado"} last={k === invited.length - 1} />
            ))}
          </View>
        )}
        {step === "privacy" && (
          <>
            <Txt v="h1">Privacidad, a tu modo.</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              {isPatient ? "Esto es lo que verán por defecto tus nuevos acompañantes. Puedes ajustarlo por persona." : "Solo verás lo que cada persona decida compartir contigo."}
            </Txt>
            {isPatient ? (
              SHARE_KEYS.map((s) => <SwitchRow key={s.key} label={s.label} value={!!share[s.key]} onValueChange={(v) => setShare({ ...share, [s.key]: v })} testID={`privacy-${s.key}-switch`} />)
            ) : (
              <Card tint="lavender">
                <Ic name="shield-check" size={22} />
                <Txt style={{ marginTop: space.sm }}>Tu acompañamiento no da control automático sobre la cuenta de nadie. Las personas acompañadas pueden cambiar tus permisos en cualquier momento.</Txt>
              </Card>
            )}
          </>
        )}
        {step === "done" && (
          <View style={{ paddingTop: space.xxl }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.sageSoft, alignItems: "center", justifyContent: "center" }}>
              <Ic name="sprout" size={32} />
            </View>
            <Txt v="display" style={{ marginTop: space.xl }}>
              Tu espacio está listo.
            </Txt>
            <Txt style={{ marginTop: space.md }}>Todo lo que elegiste se puede cambiar cuando quieras desde tu perfil. Un día a la vez, a tu modo.</Txt>
          </View>
        )}
      </Animated.View>
    </Screen>
  );
}
