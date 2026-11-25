import { useState } from "react";
import { Linking, Share, View } from "react-native";

import { API_BASE, api, invalidate, useApi } from "@/src/api";
import { Spot } from "@/src/art";
import { PlusGate, usePlus } from "@/src/components/plus-gate";
import { fmtDateTime, isDate, money, today } from "@/src/constants";
import { Pop } from "@/src/motion";
import { DateField } from "@/src/pickers";
import { useToast } from "@/src/toast";
import { Btn, Card, Chip, ChipRow, Row, Screen, Section, SwitchRow, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const SECTIONS = [
  { k: "feelings", l: "Bienestar físico y emocional" }, { k: "appointments", l: "Citas médicas" }, { k: "treatments", l: "Tratamientos" }, { k: "medications", l: "Medicamentos" },
  { k: "activities", l: "Actividades" }, { k: "expenses", l: "Gastos" }, { k: "notes", l: "Notas personales" },
];
const url = (path: string) => API_BASE.replace(/\/api$/, "") + path;

/** Plus: choose period and categories, preview, then download or share the PDF. Nothing is shared automatically. */
export default function ProcessReport() {
  const { colors } = useTheme();
  const toast = useToast();
  const { plus } = usePlus();
  const [period, setPeriod] = useState<number | "custom">(30);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(today());
  const [picked, setPicked] = useState<string[]>(SECTIONS.map((s) => s.k));
  const [name, setName] = useState(true);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<any>(null);
  const custom = period === "custom";
  const validRange = isDate(start) && isDate(end) && start <= end;
  const preview = useApi<any>(plus && !custom ? `/process?today=${today()}&days=${period}` : null);
  const reports = useApi<any[]>(plus ? "/process/reports" : null);
  const p = preview.data;
  const has = (k: string) => picked.includes(k);
  const lines = p ? [
    has("feelings") ? `Bienestar: ${p.feelings.days_logged} día(s) con registro` : "",
    has("appointments") ? `Citas y estudios: ${p.activities.counts.appointments || 0}` : "",
    has("treatments") ? `Sesiones de tratamiento: ${p.activities.counts.treatments || 0}` : "",
    has("medications") ? `Tomas marcadas: ${p.medications.done} realizadas, ${p.medications.skipped} omitidas` : "",
    has("activities") ? `Actividades: ${p.activities.counts.activities || 0}` : "",
    has("expenses") ? `Gastos: ${money(p.expenses.total)}` : "",
    has("notes") ? `Notas personales: ${p.feelings.notes.length}` : "",
  ].filter(Boolean) : [];

  const open = async (path: string) => Linking.openURL(url(path)).catch(() => toast.show("No pudimos abrir el PDF", "error"));
  const generate = async () => {
    setBusy(true);
    try {
      const r = await api("/process/reports", { method: "POST", body: { today: today(), ...(custom ? { start, end } : { days: period }), sections: picked, include_name: name } });
      setMade(r);
      invalidate();
      toast.show("Tu reporte está listo");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const fresh = async (id: string) => (await api(`/process/reports/${id}/link`, { method: "POST" })).path as string;
  const share = async (id: string) => {
    try {
      const link = url(await fresh(id));
      await Share.share({ message: `Mi resumen personal de AMODO (enlace válido 15 minutos): ${link}` });
    } catch (e: any) {
      if (e?.message) toast.show(e.message, "error");
    }
  };

  return (
    <Screen title="Mi reporte" subtitle="Un resumen personal de tus registros" testID="process-report-screen">
      <PlusGate title="Reportes con AMODO Plus" text="Crea un PDF con el periodo y las categorías que elijas. Tus registros y «Mi proceso» siguen disponibles con cualquier plan.">
        <Txt v="label" color={colors.onSurface} style={{ marginBottom: space.sm }}>Periodo</Txt>
        <ChipRow>
          {[7, 30, 90].map((d) => <Chip key={d} label={`Últimos ${d} días`} selected={period === d} onPress={() => { setPeriod(d); setMade(null); }} testID={`report-period-${d}`} />)}
          <Chip label="Elegir fechas" icon="calendar" selected={custom} onPress={() => { setPeriod("custom"); setMade(null); }} testID="report-period-custom" />
        </ChipRow>
        {custom ? (
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <DateField label="Desde" value={start} onChange={(v) => { setStart(v); setMade(null); }} testID="report-start" compact clearable={false} />
            <DateField label="Hasta" value={end} onChange={(v) => { setEnd(v); setMade(null); }} testID="report-end" compact clearable={false} />
          </View>
        ) : null}

        <Section title="Qué incluir">
          <ChipRow>
            {SECTIONS.map((s) => <Chip key={s.k} label={s.l} selected={has(s.k)} onPress={() => { setPicked(has(s.k) ? picked.filter((x) => x !== s.k) : [...picked, s.k]); setMade(null); }} testID={`report-section-${s.k}`} />)}
          </ChipRow>
          <SwitchRow label="Incluir mi nombre" value={name} onValueChange={(v) => { setName(v); setMade(null); }} testID="report-include-name" />
        </Section>

        <Card tint="butter" style={{ marginTop: space.lg, borderRadius: 24 }} testID="report-preview">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Pop trigger={made?.id} amount={0.18}><Spot name="report" size={56} pop={colors.lavender} /></Pop>
            <View style={{ flex: 1 }}>
              <Txt v="title">{made ? "Reporte listo" : "Vista previa"}</Txt>
              <Txt v="caption">{made ? made.period : custom ? (validRange ? "Periodo personalizado" : "Elige las fechas de inicio y final") : p?.period || "Cargando…"}</Txt>
            </View>
          </View>
          {picked.length === 0 ? <Txt v="caption" style={{ marginTop: space.sm }}>Elige al menos una categoría.</Txt> : custom ? <Txt v="caption" style={{ marginTop: space.sm }}>Incluirá: {SECTIONS.filter((s) => has(s.k)).map((s) => s.l.toLowerCase()).join(", ")}.</Txt>
            : lines.map((l) => <Txt key={l} v="caption" style={{ marginTop: 4 }}>· {l}</Txt>)}
          <Txt v="caption" style={{ marginTop: space.sm }}>Es un resumen personal de registros, no un expediente clínico ni una evaluación médica. No se comparte con nadie a menos que tú lo envíes.</Txt>
        </Card>

        {made ? (
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <Btn label="Descargar PDF" icon="download" style={{ flex: 1 }} onPress={async () => open(await fresh(made.id))} testID="report-download" />
            <Btn label="Compartir" icon="share-2" variant="secondary" style={{ flex: 1 }} onPress={() => share(made.id)} testID="report-share" />
          </View>
        ) : <Btn label="Generar PDF" icon="file-text" loading={busy} disabled={!picked.length || (custom && !validRange)} onPress={generate} testID="report-generate" style={{ marginTop: space.md }} />}

        <Section title="Reportes anteriores" testID="report-history">
          {(reports.data || []).length === 0 ? <Txt v="caption">Aquí aparecerán los reportes que generes.</Txt> : (reports.data || []).map((r, i, all) => (
            <Row key={r.id} icon="file-text" tint="butter" title={r.period} subtitle={`Generado el ${fmtDateTime(r.created_at)} · ${r.sections.length} categoría(s)`} onPress={async () => open(await fresh(r.id))} testID={`report-item-${r.id}`} last={i === all.length - 1} />
          ))}
        </Section>
      </PlusGate>
    </Screen>
  );
}

