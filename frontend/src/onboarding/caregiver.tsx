// The companion's own onboarding: how they accompany, what they are responsible for and what they need for themselves.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { api, invalidate, useApi } from "@/src/api";
import { Spot } from "@/src/art";
import { useAuth } from "@/src/auth";
import { fmtDate } from "@/src/constants";
import { tokenFrom } from "@/src/invite";
import { CG, CG_STEPS, CgProfile, CgStep, WEEK, emptyCg } from "@/src/onboarding/caregiver-data";
import { OptionCards } from "@/src/onboarding/options";
import { DateField, TimeField, fmtTime, use24h } from "@/src/pickers";
import { useToast } from "@/src/toast";
import { Btn, Card, Chip, ChipRow, Field, Ic, IconBtn, ProgressBar, Row, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const HEAD: Record<CgStep, { t: string; s: string }> = {
  welcome: { t: "Acompañar también es un proceso.", s: "Queremos conocer cómo acompañas y qué necesitas para organizar tus responsabilidades, apoyar a esa persona y tener espacio para ti." },
  relation: { t: "Tu relación con la persona que acompañas", s: "Nos ayuda a hablarte de forma cercana. Puedes cambiarlo cuando quieras." },
  duties: { t: "Tus responsabilidades", s: "Con esto ordenamos tus accesos rápidos. No te asignamos nada sin que tú lo confirmes." },
  hard: { t: "Lo que más cuesta organizar", s: "No hay respuestas buenas o malas. Solo queremos saber dónde puede ayudarte AMODO." },
  organize: { t: "Tu forma de organizarte", s: "Cada persona se organiza distinto. Elige lo que va contigo." },
  at_hand: { t: "Lo que quieres tener a la mano", s: "Tu Inicio mostrará primero lo que elijas. Solo verás lo que la persona decida compartir contigo." },
  availability: { t: "Tu disponibilidad", s: "Es opcional y solo tú la ves por ahora. Sirve para organizar tu tiempo, no para asignarte tareas." },
  wellbeing: { t: "También hay espacio para ti.", s: "Sabemos que acompañar implica nuevas responsabilidades. Queremos conocer qué podría ayudarte en tu día a día." },
  link: { t: "Vincúlate con quien acompañas", s: "No es obligatorio para terminar. Si aún no te vinculas, puedes usar tus herramientas personales de organización y bienestar." },
  done: { t: "Tu espacio está listo.", s: "Todo lo que elegiste se puede cambiar desde tu perfil. Acompañar es un día a la vez, y aquí también hay lugar para ti." },
};

export function CaregiverOnboarding() {
  const { user, updateMe } = useAuth();
  const params = useLocalSearchParams<{ edit?: string; step?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const h24 = use24h();
  const editing = params.edit === "1";
  const [i, setI] = useState(Math.max(editing ? 1 : 0, CG_STEPS.indexOf((params.step || "") as CgStep)));
  const step = CG_STEPS[i];
  const p = user?.profile || {};
  const [a, setA] = useState<CgProfile>({ ...emptyCg(p.about), ...(p.caregiver || {}) });
  const [slot, setSlot] = useState<{ days: string[]; date: string; start: string; end: string } | null>(null);
  const [mode, setMode] = useState<"" | "code">("");
  const [paste, setPaste] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const net = useApi<any>(step === "link" || step === "done" ? "/network" : null);
  const linked: any[] = net.data?.as_caregiver || [];
  const set = <K extends keyof CgProfile>(k: K) => (v: CgProfile[K]) => setA((x) => ({ ...x, [k]: v }));

  const next = async (skip = false) => {
    setSaving(true);
    try {
      if (!skip && step !== "welcome" && step !== "link" && step !== "done") await updateMe({ profile: { caregiver: a } });
      if (editing) {
        toast.show("Preferencias guardadas");
        return router.back();
      }
      if (step === "done") {
        await updateMe({ onboarding_done: true });
        return router.replace("/(tabs)");
      }
      setI(i + 1);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const join = async () => {
    try {
      const l = await api("/network/join", { method: "POST", body: { code, relation: a.who } });
      invalidate();
      setCode("");
      toast.show(`Te vinculaste con ${l.patient_name}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const addSlot = () => {
    if (!slot || (!slot.days.length && !slot.date)) return toast.show("Elige al menos un día", "error");
    set("availability")({ ...a.availability, slots: [...a.availability.slots, slot] });
    setSlot(null);
  };

  const footer = (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {step !== "done" && step !== "welcome" && !editing ? <Btn label="Completar después" variant="ghost" onPress={() => next(true)} testID="onboarding-skip-button" style={{ flex: 1 }} /> : null}
      <Btn label={step === "done" ? "Ir a mi inicio" : editing ? "Guardar" : step === "welcome" ? "Comenzar" : "Continuar"} loading={saving} onPress={() => next()} testID="onboarding-next-button" style={{ flex: 1 }} />
    </View>
  );

  return (
    <Screen back={editing || i > 0} onBack={!editing && i > 0 ? () => setI(i - 1) : undefined} testID={`onboarding-${step}-screen`} footer={footer}>
      {!editing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ flex: 1 }}><ProgressBar value={(i + 1) / CG_STEPS.length} /></View>
          <Txt v="caption" testID="onboarding-progress">{i + 1} de {CG_STEPS.length}</Txt>
        </View>
      ) : null}
      <Animated.View key={step} entering={FadeIn.duration(260)} style={{ marginTop: space.lg }}>
        {step === "welcome" || step === "wellbeing" || step === "done" ? (
          <View style={{ backgroundColor: step === "wellbeing" ? colors.butter : step === "done" ? colors.sage : colors.lavender, borderRadius: 28, padding: space.xl, marginBottom: space.xl, overflow: "hidden" }}>
            <Spot name={step === "wellbeing" ? "heart" : step === "done" ? "process" : "network"} size={72} pop={colors.surfaceSecondary} />
            <Txt v="display" style={{ marginTop: space.md }}>{HEAD[step].t}</Txt>
            <Txt style={{ marginTop: space.sm }}>{HEAD[step].s}</Txt>
          </View>
        ) : (
          <>
            <Txt v="h1">{HEAD[step].t}</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>{HEAD[step].s}</Txt>
          </>
        )}

        {step === "welcome" && (
          <>
            {[["users", "Cómo acompañas y en qué apoyas"], ["layout-grid", "Cómo prefieres organizarte"], ["coffee", "Qué necesitas tú"]].map(([ic, t]) => (
              <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}><Ic name={ic} size={18} /></View>
                <Txt style={{ flex: 1 }}>{t}</Txt>
              </View>
            ))}
            <Txt v="caption">Son pasos breves y todos opcionales. Puedes completar tu perfil poco a poco.</Txt>
          </>
        )}
        {step === "relation" && (
          <>
            <OptionCards label="¿A quién acompañas?" options={CG.who} value={a.who ? [a.who] : []} onChange={(v) => set("who")(v[0] || "")} multi={false} allowCustom testID="cg-who" />
            <OptionCards label="¿Cómo participas en su acompañamiento?" options={CG.mode} value={a.mode ? [a.mode] : []} onChange={(v) => set("mode")(v[0] || "")} multi={false} columns={1} allowCustom testID="cg-mode" />
          </>
        )}
        {step === "duties" && <OptionCards label="¿En qué actividades sueles apoyar?" options={CG.duties} value={a.duties} onChange={set("duties")} allowCustom testID="cg-duty" />}
        {step === "hard" && <OptionCards label="¿Qué aspectos del acompañamiento te resultan más difíciles de organizar?" options={CG.hard} value={a.hard} onChange={set("hard")} allowCustom testID="cg-hard" />}
        {step === "organize" && <OptionCards label="¿Cómo prefieres organizar tus responsabilidades?" options={CG.organize} value={a.organize} onChange={set("organize")} testID="cg-organize" />}
        {step === "at_hand" && <OptionCards label="¿Qué información te gustaría tener más a la mano?" options={CG.at_hand} value={a.at_hand} onChange={set("at_hand")} testID="cg-hand" />}
        {step === "availability" && (
          <>
            <OptionCards label="¿Cuándo sueles estar disponible para acompañar?" options={CG.when} value={a.availability.when} onChange={(v) => set("availability")({ ...a.availability, when: v })} testID="cg-when" />
            <Txt v="title">Días y horarios específicos</Txt>
            <Txt v="caption" style={{ marginBottom: space.md }}>Opcional. Agrega los que quieras; se pueden cambiar después.</Txt>
            {a.availability.slots.map((s, k) => (
              <Row key={k} icon="clock" tint="sky" title={s.date ? fmtDate(s.date) : s.days.join(", ")} subtitle={s.start || s.end ? `${s.start ? fmtTime(s.start, h24) : "…"} a ${s.end ? fmtTime(s.end, h24) : "…"}` : "Todo el día"} testID={`cg-slot-${k}`}
                right={<IconBtn icon="trash-2" onPress={() => set("availability")({ ...a.availability, slots: a.availability.slots.filter((_, j) => j !== k) })} testID={`cg-slot-remove-${k}`} />} last />
            ))}
            {slot ? (
              <Card style={{ marginTop: space.sm }} testID="cg-slot-form">
                <Txt v="label" style={{ marginBottom: 6 }}>Días de la semana</Txt>
                <ChipRow>{WEEK.map((d) => <Chip key={d} label={d} selected={slot.days.includes(d)} onPress={() => setSlot({ ...slot, date: "", days: slot.days.includes(d) ? slot.days.filter((x) => x !== d) : [...slot.days, d] })} testID={`cg-slot-day-${d}`} />)}</ChipRow>
                <View style={{ height: space.md }} />
                <DateField label="O un día en particular" value={slot.date} onChange={(v) => setSlot({ ...slot, date: v, days: v ? [] : slot.days })} testID="cg-slot-date" />
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <View style={{ flex: 1 }}><TimeField label="Desde" value={slot.start} onChange={(v) => setSlot({ ...slot, start: v })} testID="cg-slot-start" /></View>
                  <View style={{ flex: 1 }}><TimeField label="Hasta" value={slot.end} onChange={(v) => setSlot({ ...slot, end: v })} testID="cg-slot-end" /></View>
                </View>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Btn label="Cancelar" small variant="ghost" onPress={() => setSlot(null)} testID="cg-slot-cancel" style={{ flex: 1 }} />
                  <Btn label="Agregar horario" small icon="plus" onPress={addSlot} testID="cg-slot-save" style={{ flex: 1 }} />
                </View>
              </Card>
            ) : <Btn label="Agregar días y horario" small variant="secondary" icon="plus" onPress={() => setSlot({ days: [], date: "", start: "", end: "" })} testID="cg-slot-add" style={{ alignSelf: "flex-start", marginTop: space.sm }} />}
          </>
        )}
        {step === "wellbeing" && (
          <>
            <OptionCards label="¿Qué te gustaría que AMODO te ayudara a hacer?" options={CG.goals} value={a.goals} onChange={set("goals")} allowCustom testID="cg-goal" />
            <OptionCards label="¿Qué actividades disfrutas hacer en tu tiempo personal?" hint="Opcional. Son tuyas: no se usan para elegir artículos de la persona que acompañas." options={CG.interests} value={a.interests} onChange={set("interests")} allowCustom testID="cg-interest" />
          </>
        )}
        {step === "link" && (
          <>
            {linked.map((l) => <Row key={l.id} icon="check" tint="sage" title={l.patient_name} subtitle={l.status === "active" ? "Vinculado. Verás solo lo que decida compartir contigo." : "Pendiente de respuesta"} testID={`cg-linked-${l.id}`} last />)}
            {[{ k: "scan", ic: "scan-line", t: "Escanear código QR", s: "Desde el teléfono de la persona que acompañas.", go: () => router.push("/scan") },
              { k: "code", ic: "link", t: "Usar un enlace o código de invitación", s: "Pega el enlace que te envió o escribe su código.", go: () => setMode(mode === "code" ? "" : "code") },
              { k: "later", ic: "clock", t: "Vincular más adelante", s: "Podrás hacerlo desde tu Perfil cuando quieras.", go: () => next(true) }].map((o, n) => (
              <Pressable key={o.k} onPress={o.go} testID={`cg-link-${o.k}`} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: [colors.sage, colors.lavender, colors.surfaceSecondary][n], borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Ic name={o.ic} size={20} /></View>
                <View style={{ flex: 1 }}><Txt v="title">{o.t}</Txt><Txt v="caption" color={colors.onSurface}>{o.s}</Txt></View>
                <Ic name="chevron-right" size={18} />
              </Pressable>
            ))}
            {mode === "code" ? (
              <View style={{ marginTop: space.md }}>
                <Field label="Enlace de invitación" value={paste} onChangeText={setPaste} placeholder="Pega aquí el enlace" autoCapitalize="none" testID="cg-link-paste" />
                <Btn label="Abrir invitación" variant="secondary" icon="link" disabled={!tokenFrom(paste)} onPress={() => router.push({ pathname: "/invite", params: { token: tokenFrom(paste) } })} testID="cg-link-open" />
                <Field label="Código de invitación" value={code} onChangeText={(v) => setCode(v.toUpperCase())} maxLength={6} autoCapitalize="characters" placeholder="Ej. K7P2QX" testID="join-code-input" style={{ marginTop: space.lg }} />
                <Btn label="Vincularme con código" variant="secondary" icon="key-round" disabled={code.length < 6} onPress={join} testID="join-code-button" />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
              <Ic name="shield-check" size={16} />
              <Txt v="caption" style={{ flex: 1 }}>Vincularte no te da control sobre la cuenta de nadie. No te pediremos de nuevo los datos de la persona: si ya los registró, verás solo lo que autorice.</Txt>
            </View>
          </>
        )}
        {step === "done" && (
          <>
            {linked.length === 0 ? <Txt v="caption" style={{ marginBottom: space.md }}>Aún no estás vinculado/a con nadie. Mientras tanto tienes tu agenda, tus pendientes, tus listas y tu registro de bienestar.</Txt> : null}
            <Btn label="Crear mi avatar (opcional)" variant="secondary" icon="smile" onPress={() => router.push("/avatar")} testID="onboarding-avatar-button" style={{ alignSelf: "flex-start" }} />
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
