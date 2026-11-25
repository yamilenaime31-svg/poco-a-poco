import { useState } from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";

import { API_BASE, api, useApi } from "@/src/api";
import { HBars, WeekBars } from "@/src/components/bars";
import { money, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Card, Chip, ChipRow, Empty, ErrorState, Loading, Row, Screen, Section, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const PERIODS = [{ d: 7, l: "7 días" }, { d: 30, l: "30 días" }, { d: 90, l: "90 días" }];
const times = (v: number) => `${v} día${v === 1 ? "" : "s"}`;

/** Mi proceso: what the person registered about wellbeing, activities, medication and expenses, with charts and a PDF. */
export default function Process() {
  const router = useRouter();
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const q = useApi<any>(`/process?today=${today()}&days=${days}`);
  const d = q.data;

  const pdf = async () => {
    setBusy(true);
    try {
      const r = await api("/process/pdf-link", { method: "POST", body: { today: today(), days } });
      await Linking.openURL(API_BASE.replace(/\/api$/, "") + r.path);
    } catch (e: any) {
      toast.show(e.message || "No pudimos abrir el PDF", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Mi proceso" subtitle="Tu bienestar y tus actividades, a lo largo del tiempo" testID="process-screen" refreshing={q.isRefetching} onRefresh={q.refetch}
      footer={<Btn label="Descargar resumen en PDF" icon="download" loading={busy} disabled={!d} onPress={pdf} testID="process-pdf" />}>
      <ChipRow>
        {PERIODS.map((p) => <Chip key={p.d} label={p.l} selected={days === p.d} onPress={() => setDays(p.d)} testID={`process-period-${p.d}`} />)}
      </ChipRow>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
        <>
          <Txt v="caption" style={{ marginTop: space.sm }} testID="process-period">{d.period}</Txt>
          {d.empty ? <Empty icon="chart-no-axes-column" title="Aún no hay registros en este periodo" text="Cuando registres cómo te sientes, tus citas, tomas o gastos, aquí verás tu proceso." testID="process-empty" /> : null}

          <Section title="Cómo me he sentido" testID="process-feelings">
            <Card>
              <Txt v="title">{d.feelings.days_logged} de {d.days} días con registro</Txt>
              <WeekBars weeks={d.weeks} field="feel_days" testID="process-feel-weeks" />
              <Txt v="caption" style={{ marginTop: 4 }}>Días registrados por semana</Txt>
            </Card>
            {d.feelings.moods.length ? <View style={{ marginTop: space.md }}><HBars rows={d.feelings.moods} format={times} testID="process-moods" /></View> : <Txt v="caption" style={{ marginTop: space.sm }}>Registra cómo te sientes desde Inicio, solo si quieres.</Txt>}
            {d.feelings.energy.length ? <View style={{ marginTop: space.lg }}><Txt v="label" style={{ marginBottom: space.sm }}>Energía</Txt><HBars rows={d.feelings.energy} format={times} /></View> : null}
            {d.feelings.signals.length ? <View style={{ marginTop: space.lg }}><Txt v="label" style={{ marginBottom: space.sm }}>Señales que enviaste</Txt><HBars rows={d.feelings.signals} /></View> : null}
          </Section>

          <Section title="Citas y tratamientos" testID="process-activities">
            <Card>
              <Txt v="title">{d.activities.total} actividad{d.activities.total === 1 ? "" : "es"} en tu agenda</Txt>
              <WeekBars weeks={d.weeks} field="activities" testID="process-activity-weeks" />
              <Txt v="caption" style={{ marginTop: 4 }}>Actividades por semana</Txt>
            </Card>
            {d.activities.by_category.length ? <View style={{ marginTop: space.md }}><HBars rows={d.activities.by_category} /></View> : null}
            {d.activities.treatments.map((t: any, i: number) => (
              <Row key={`${t.name}-${i}`} icon="layers" tint="sand" title={t.name} subtitle={[t.status, t.cycle ? `Ciclo ${t.cycle}` : "", `${t.sessions} sesión(es) en el periodo`].filter(Boolean).join(" · ")} last={i === d.activities.treatments.length - 1} />
            ))}
          </Section>

          <Section title="Medicamentos" testID="process-medications">
            {d.medications.done || d.medications.skipped ? (
              <>
                <HBars rows={[{ label: "Tomas realizadas", value: d.medications.done }, { label: "Tomas omitidas", value: d.medications.skipped }]} testID="process-doses" />
                {d.medications.by_med.map((m: any) => <Txt key={m.name} v="caption" style={{ marginTop: 4 }}>{m.name}: {m.realizado} realizadas · {m.omitido} omitidas</Txt>)}
              </>
            ) : <Txt v="caption">Sin tomas marcadas en este periodo.</Txt>}
            <Txt v="caption" style={{ marginTop: space.sm }}>Solo cuenta lo que marcaste de forma explícita.</Txt>
          </Section>

          <Section title="Gastos" testID="process-expenses">
            {d.expenses.by_category.length ? (
              <>
                <Txt v="title">{money(d.expenses.total)}</Txt>
                <Txt v="caption" style={{ marginBottom: space.md }}>Pagado: {money(d.expenses.paid)} · Pendiente: {money(d.expenses.pending)}</Txt>
                <HBars rows={d.expenses.by_category} format={money} testID="process-expense-cats" />
              </>
            ) : <Txt v="caption">Sin gastos registrados en este periodo.</Txt>}
          </Section>

          <Section title="También">
            <Row icon="history" tint="sand" title="Historial personal" subtitle="Cada registro, en orden" onPress={() => router.push("/history")} testID="process-history" last />
          </Section>
          <Txt v="caption" style={{ marginTop: space.lg }}>{d.note}</Txt>
        </>
      )}
    </Screen>
  );
}
