import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { fmtLongDate, today } from "@/src/constants";
import { SingleChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Card, ErrorState, Field, Loading, Row, Screen, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function MyDay() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const t = today();
  const q = useApi<any>(`/home?today=${t}&role=patient`);
  const d = q.data?.role === "patient" ? q.data : undefined;
  const [energy, setEnergy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (d?.journal) {
      setEnergy(d.journal.energy || "");
      setNote(d.journal.note || "");
    }
  }, [d?.journal]);

  const save = async () => {
    setSaving(true);
    try {
      if (d?.journal) await api(`/records/journal/${d.journal.id}`, { method: "PUT", body: { energy, note } });
      else await api("/records/journal", { method: "POST", body: { date: t, energy, note } });
      invalidate();
      toast.show("Guardado. Gracias por compartirlo contigo.");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Mi día" subtitle={fmtLongDate(t)} testID="my-day-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.isLoading || !d ? <Loading /> : (
        <>
          <Txt v="caption">Lo que hay hoy, sin prisa. Puedes mover o cambiar cualquier cosa.</Txt>
          <Section title="Hoy" action="Agregar" onAction={() => router.push({ pathname: "/record-form", params: { kind: "events", date: t } })} testID="day-events-section" style={{ marginTop: space.xl }}>
            {d.today_events.length === 0 ? <Txt v="caption">Tu día está libre hoy.</Txt> : d.today_events.map((e: any, i: number) => (
              <Row key={e.id} icon="calendar" tint="sage" title={`${e.time ? `${e.time} · ` : ""}${e.title}`} subtitle={e.location} onPress={() => router.push(`/event/${e.id}`)} testID={`day-event-${e.id}`} last={i === d.today_events.length - 1} />
            ))}
          </Section>
          {d.transfers_today.length ? (
            <Section title="Traslados de hoy">
              {d.transfers_today.map((tr: any, i: number) => (
                <Row key={tr.id} icon="car" tint="lavender" title={`${tr.time ? `${tr.time} · ` : ""}${tr.title}`} subtitle={[tr.mode, tr.driver].filter(Boolean).join(" · ")} onPress={() => router.push({ pathname: "/record-form", params: { kind: "transfers", id: tr.id } })} testID={`day-transfer-${tr.id}`} last={i === d.transfers_today.length - 1} />
              ))}
            </Section>
          ) : null}
          <Section title="Medicamentos registrados" action="Ver" onAction={() => router.push("/records/medications")}>
            {d.medications.length === 0 ? <Txt v="caption">No has registrado medicamentos.</Txt> : d.medications.map((m: any, i: number) => (
              <Row key={m.id} icon="pill" tint="lavender" title={m.name} subtitle={[m.dose, m.schedule].filter(Boolean).join(" · ")} last={i === d.medications.length - 1} />
            ))}
            <Txt v="caption" style={{ marginTop: space.xs }}>
              Solo un recordatorio de lo que registraste. Sigue las indicaciones de tu equipo médico.
            </Txt>
          </Section>
          <Section title="Pendientes" action="Ver" onAction={() => router.push("/records/tasks")}>
            {d.tasks.length === 0 ? <Txt v="caption">Nada pendiente.</Txt> : d.tasks.slice(0, 4).map((tk: any, i: number) => <Row key={tk.id} icon="circle" tint="sand" title={tk.title} last={i === Math.min(3, d.tasks.length - 1)} />)}
          </Section>
          <Card style={{ marginTop: space.xxl }} testID="day-journal-card">
            <Txt v="label">Registro de hoy · opcional</Txt>
            <Txt v="title" style={{ marginTop: space.xs, marginBottom: space.lg }}>
              ¿Quieres dejar una nota para ti?
            </Txt>
            <SingleChoice options={["Con energía", "Normal", "Cansancio", "Prefiero no decir"]} value={energy} onChange={setEnergy} testID="day-energy" />
            <Field value={note} onChangeText={setNote} multiline placeholder="Lo que quieras recordar de hoy" testID="day-note-input" />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Btn label="Guardar" small loading={saving} onPress={save} testID="day-journal-save-button" style={{ flex: 1 }} />
              <Btn label="Pedir apoyo" small variant="secondary" icon="radio" onPress={() => router.push("/signals")} testID="day-signal-button" style={{ flex: 1 }} />
            </View>
          </Card>
          <Txt v="caption" color={colors.muted} style={{ marginTop: space.lg, textAlign: "center" }}>
            Un día a la vez, a tu modo.
          </Txt>
        </>
      )}
    </Screen>
  );
}
