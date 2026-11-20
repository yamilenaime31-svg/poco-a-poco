import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate } from "@/src/api";
import { PlusGate } from "@/src/components/plus-gate";
import { ShareWith } from "@/src/components/share-with";
import { TREATMENT_TYPES, fmtLongDate, isDate, isTime, isoDate, today } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Field, Ic, Screen, Txt } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

type Plan = { name: string; treatment_type: string; start_date: string; time: string; interval_days: number | null; weekdays: number[]; sessions_count: number | null; location: string; notes: string; questions: string[]; sessions: { date: string; time: string }[] };

function build(p: Plan) {
  if (!isDate(p.start_date) || !p.sessions_count) return [];
  const out: { date: string; time: string }[] = [];
  const d = new Date(`${p.start_date}T12:00:00`);
  const n = Math.min(60, p.sessions_count);
  if (p.weekdays?.length) {
    while (out.length < n) {
      if (p.weekdays.includes((d.getDay() + 6) % 7)) out.push({ date: isoDate(d), time: p.time });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  if (!p.interval_days) return n === 1 ? [{ date: p.start_date, time: p.time }] : [];
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i * p.interval_days);
    out.push({ date: isoDate(x), time: p.time });
  }
  return out;
}

export default function TreatmentAssistant() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [share, setShare] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const parse = async () => {
    setBusy(true);
    try {
      const r = await api<Plan>("/treatments/parse", { method: "POST", body: { text, today: today() } });
      setPlan({ ...r, name: r.name ? r.name[0].toUpperCase() + r.name.slice(1) : r.treatment_type });
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  // Changing the rule regenerates the list; individual sessions can still be edited or removed afterwards.
  const setRule = (patch: Partial<Plan>) => setPlan((p) => { const n = { ...p!, ...patch }; return { ...n, sessions: build(n) }; });
  const setSession = (i: number, patch: any) => setPlan((p) => ({ ...p!, sessions: p!.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const missing = plan ? [!isDate(plan.start_date) && "fecha de inicio", !plan.interval_days && !plan.weekdays?.length && "frecuencia", !plan.sessions_count && "número de sesiones"].filter(Boolean) : [];
  const invalid = plan?.sessions.some((s) => !isDate(s.date) || (s.time && !isTime(s.time)));

  const confirm = async () => {
    setSaving(true);
    try {
      const r = await api("/treatments/plan", { method: "POST", body: { ...plan, shared_with: share } });
      invalidate();
      toast.show(`Guardamos tu tratamiento y ${r.sessions} sesión(es) en tu agenda`);
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/agenda");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Cuéntame sobre tu tratamiento" subtitle="Escribe lo que te indicaron y te ayudo a organizarlo" testID="treatment-assistant-screen"
      footer={plan ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Btn label="Cancelar" variant="ghost" onPress={() => setPlan(null)} testID="ta-cancel" style={{ flex: 1 }} />
          <Btn label="Confirmar" icon="check" loading={saving} disabled={!plan.name.trim() || invalid} onPress={confirm} testID="ta-confirm" style={{ flex: 2 }} />
        </View>
      ) : undefined}>
      {!plan ? (
        <PlusGate title="Asistente de tratamientos con AMODO Plus" text="Escribe lo que te indicaron y se convierte en sesiones recurrentes editables. Con cualquier plan puedes registrar tratamientos y citas manualmente desde Tratamientos y Agenda."
          testID="ta-plus-gate" preview={<Txt v="caption">“Quimioterapia cada 21 días, empezando el 25 de noviembre, seis sesiones a las 9:00” → Sesión 1, Sesión 2…</Txt>}>
          <TextInput testID="ta-input" value={text} onChangeText={setText} multiline placeholderTextColor={colors.muted}
            placeholder="Ej. Voy a tener quimioterapia cada 21 días, empezando el 25 de noviembre. Son seis sesiones y tengo que llegar a las 9 de la mañana."
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
          <Btn label="Organizar" icon="wand-sparkles" loading={busy} disabled={text.trim().length < 3} onPress={parse} testID="ta-parse" />
          <View style={styles.note}>
            <Ic name="shield-check" size={14} color={colors.muted} />
            <Txt v="caption" style={{ flex: 1 }}>Solo organizo lo que escribes. No decido dosis, frecuencias ni duración, y nada se guarda hasta que confirmes.</Txt>
          </View>
</PlusGate>
      ) : (
        <>
          <Txt v="h2" style={{ marginBottom: space.md }}>Así quedaría organizado tu tratamiento</Txt>
          <SingleChoice label="Tipo" options={TREATMENT_TYPES} value={plan.treatment_type} onChange={(v) => setPlan({ ...plan, treatment_type: v || "Otro" })} testID="ta-type" />
          <Field label="Nombre" value={plan.name} onChangeText={(v) => setPlan({ ...plan, name: v })} placeholder="Escribe el nombre del tratamiento" testID="ta-name" />
          {missing.length ? (
            <View style={[styles.ask, { backgroundColor: colors.coralSoft }]} testID="ta-questions">
              <Txt v="medium" style={{ fontSize: 14 }}>Me falta saber: {missing.join(", ")}.</Txt>
              {plan.questions.map((q) => <Txt key={q} v="caption" color={colors.onSurface}>· {q}</Txt>)}
            </View>
          ) : null}
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Field label="Inicio" value={plan.start_date} onChangeText={(v) => setRule({ start_date: v })} placeholder="AAAA-MM-DD" testID="ta-start" maxLength={10} /></View>
            <View style={{ flex: 1 }}><Field label="Hora" value={plan.time} onChangeText={(v) => setRule({ time: v })} placeholder="HH:MM" testID="ta-time" maxLength={5} /></View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Field label="Cada (días)" value={plan.interval_days ? String(plan.interval_days) : ""} keyboardType="number-pad" onChangeText={(v) => setRule({ interval_days: Number(v) || null, weekdays: [] })} placeholder={plan.weekdays?.length ? "Días fijos" : "Ej. 21"} testID="ta-interval" /></View>
            <View style={{ flex: 1 }}><Field label="Sesiones" value={plan.sessions_count ? String(plan.sessions_count) : ""} keyboardType="number-pad" onChangeText={(v) => setRule({ sessions_count: Number(v) || null })} placeholder="Ej. 6" testID="ta-count" /></View>
          </View>
          <Field label="Lugar (opcional)" value={plan.location} onChangeText={(v) => setPlan({ ...plan, location: v })} testID="ta-location" />

          <Txt v="label" style={{ marginBottom: space.sm }}>Sesiones propuestas ({plan.sessions.length})</Txt>
          {plan.sessions.length === 0 ? <Txt v="caption" style={{ marginBottom: space.lg }}>Completa inicio, frecuencia y número de sesiones para ver la lista.</Txt> : null}
          {plan.sessions.map((s, i) => (
            <View key={i} style={[styles.session, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID={`ta-session-${i}`}>
              <View style={{ flex: 1 }}>
                <Txt v="medium" style={{ fontSize: 14 }}>Sesión {i + 1}{isDate(s.date) ? ` — ${fmtLongDate(s.date)}` : ""}</Txt>
                <View style={styles.row2}>
                  <TextInput value={s.date} onChangeText={(v) => setSession(i, { date: v })} maxLength={10} testID={`ta-session-date-${i}`} style={[styles.mini, { borderColor: colors.border, color: colors.onSurface }]} />
                  <TextInput value={s.time} onChangeText={(v) => setSession(i, { time: v })} maxLength={5} placeholder="HH:MM" placeholderTextColor={colors.muted} testID={`ta-session-time-${i}`} style={[styles.miniTime, { borderColor: colors.border, color: colors.onSurface }]} />
                </View>
              </View>
              <Pressable onPress={() => setPlan({ ...plan, sessions: plan.sessions.filter((_, j) => j !== i), sessions_count: plan.sessions.length - 1 || null })} hitSlop={8} testID={`ta-session-remove-${i}`} accessibilityLabel="Eliminar sesión" style={styles.remove}>
                <Ic name="trash-2" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          <View style={{ marginTop: space.md }}><ShareWith value={share} onChange={setShare} testID="ta-share" /></View>
          <Txt v="caption" style={{ marginTop: space.sm }}>Cada sesión aparecerá en tu Agenda y en Tratamientos. Si luego cambias una, te preguntaremos si aplica solo a esa fecha o a las siguientes.</Txt>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 140, borderRadius: radius.md, borderWidth: 1, padding: space.md, marginBottom: space.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  note: { flexDirection: "row", gap: 6, marginTop: space.md },
  ask: { borderRadius: radius.md, padding: space.md, marginBottom: space.lg, gap: 2 },
  row2: { flexDirection: "row", gap: space.sm },
  session: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  miniTime: { width: 76, flexGrow: 0, flexShrink: 0, height: 38, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.sm, marginTop: 6, fontFamily: fonts.body, fontSize: 14 },
  mini: { flex: 1, minWidth: 0, height: 38, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.sm, marginTop: 6, fontFamily: fonts.body, fontSize: 14 },
  remove: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
