import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { Spot } from "@/src/art";
import { fmtDate } from "@/src/constants";
import { COVERAGE_DOCS, Docs, Fold } from "@/src/finance/shared";
import { DateField } from "@/src/pickers";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Chip, ChipRow, Empty, ErrorState, Field, Loading, Row, Screen, Section, Sheet, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

type F = [string, string, ("date" | "multi")?];
const PRIVATE: { t: string; f: F[] }[] = [
  { t: "Información general", f: [["insurer", "Aseguradora"], ["plan", "Nombre del plan"], ["policy_number", "Número de póliza"], ["certificate", "Número de certificado"], ["insured", "Nombre del asegurado"], ["holder", "Nombre del titular"],
    ["valid_from", "Inicio de vigencia", "date"], ["valid_until", "Vencimiento", "date"], ["policy_type", "Tipo de póliza (individual, familiar o colectiva)"], ["company", "Empresa contratante"]] },
  { t: "Condiciones económicas", f: [["sum_insured", "Suma asegurada"], ["deductible", "Deducible"], ["coinsurance", "Coaseguro"], ["coinsurance_cap", "Tope de coaseguro"], ["currency", "Moneda"], ["deductible_period", "Periodo de aplicación del deducible"],
    ["conditions", "Condiciones particulares", "multi"], ["exclusions", "Exclusiones o restricciones", "multi"], ["fee_schedule", "Tabuladores médicos", "multi"]] },
  { t: "Contactos", f: [["agent", "Agente de seguros"], ["agent_phone", "Teléfono del agente"], ["agent_email", "Correo del agente"], ["phone", "Atención de la aseguradora"], ["refund_contact", "Contacto para reembolsos"],
    ["auth_contact", "Contacto para autorizaciones"], ["network", "Hospitales o médicos de referencia", "multi"]] },
];
const PUBLIC: { t: string; f: F[] }[] = [{ t: "Datos de la institución", f: [["affiliation", "Número de afiliación o identificación"], ["unit", "Unidad médica asignada"], ["hospital", "Hospital de referencia"], ["doctor", "Médico tratante"],
  ["specialty", "Especialidad"], ["address", "Dirección de la unidad"], ["phone", "Teléfono de contacto"], ["procedures", "Citas y trámites", "multi"], ["notes", "Notas personales", "multi"]] }];
const SUPPORT: { t: string; f: F[] }[] = [{ t: "Datos del apoyo", f: [["institution", "Nombre de la institución"], ["support_type", "Tipo de apoyo"], ["authorized", "Monto autorizado"], ["received", "Monto recibido"],
  ["valid_until", "Vigencia", "date"], ["contact", "Persona de contacto"], ["requirements", "Requisitos", "multi"], ["restrictions", "Restricciones", "multi"], ["notes", "Notas", "multi"]] }];
const OWN: { t: string; f: F[] }[] = [{ t: "Notas", f: [["notes", "Notas personales", "multi"]] }];
const TYPES: { t: string; g: typeof PRIVATE; tint: string }[] = [
  { t: "Seguro de Gastos Médicos Mayores", g: PRIVATE, tint: "lavender" }, { t: "Seguro médico privado", g: PRIVATE, tint: "lavender" }, { t: "Seguro colectivo empresarial", g: PRIVATE, tint: "lavender" },
  { t: "IMSS", g: PUBLIC, tint: "sage" }, { t: "ISSSTE", g: PUBLIC, tint: "sage" }, { t: "IMSS-Bienestar", g: PUBLIC, tint: "sage" },
  { t: "Fundación o asociación", g: SUPPORT, tint: "butter" }, { t: "Apoyo institucional", g: SUPPORT, tint: "butter" },
  { t: "Atención particular con recursos propios", g: OWN, tint: "sky" }, { t: "Otra cobertura", g: PUBLIC, tint: "mauve" }, { t: "No cuento con cobertura médica", g: OWN, tint: "sand" },
];
const defOf = (t: string) => TYPES.find((x) => x.t === t) || TYPES[9];
const mask = (v?: string) => (v ? `••• ${v.slice(-4)}` : "");

/** Mi cobertura médica: optional, several at once, fields depend on the kind of coverage. A personal record, not a link to any insurer. */
export default function Coverage() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useApi<any[]>("/coverages");
  const acc = useApi<any>("/finance/access");
  const [pick, setPick] = useState(false);
  const [c, setC] = useState<any>(null); // coverage being edited
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<any>(null); // AI proposal to review
  const set = (k: string) => (v: string) => setC((p: any) => ({ ...p, data: { ...p.data, [k]: v } }));

  const save = async (extra: any = {}) => {
    setSaving(true);
    try {
      const r = await api("/coverages", { method: "POST", body: { ...c, ...extra } });
      invalidate();
      toast.show(extra.archived ? "Cobertura archivada" : "Cobertura guardada");
      if (!c.id && !extra.archived) setC(r); else setC(null);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (c) {
    const def = defOf(c.type);
    return (
      <Screen title={c.id ? "Editar cobertura" : "Nueva cobertura"} subtitle={c.type} onBack={() => setC(null)} testID="coverage-form"
        footer={<Btn label={c.id ? "Guardar cambios" : "Guardar cobertura"} loading={saving} onPress={() => save()} testID="coverage-save" />}
        overlay={
          <Sheet visible={!!draft} onClose={() => setDraft(null)} title="Datos encontrados" testID="coverage-draft-sheet">
            <Txt v="caption" style={{ marginBottom: space.sm }}>Borrador creado con IA. Toca los que quieras usar; puedes corregirlos después. No es asesoría ni garantiza coberturas.</Txt>
            {Object.entries(draft || {}).filter(([k]) => k !== "sources").map(([k, v]) => (
              <Row key={k} title={String(v)} subtitle={`${k}${draft.sources?.[k] ? ` · origen: ${draft.sources[k]}` : ""}`} onPress={() => { set(k)(String(v)); setDraft((d: any) => { const n = { ...d }; delete n[k]; return n; }); }} testID={`coverage-draft-${k}`} right={<Badge label="Usar" tint="lavender" />} last />
            ))}
            <Btn label="Listo" onPress={() => setDraft(null)} testID="coverage-draft-done" style={{ marginTop: space.md }} />
          </Sheet>
        }>
        <Field label={c.type === "Otra cobertura" ? "Nombre de la cobertura" : "Nombre para identificarla"} value={c.name} onChangeText={(v) => setC({ ...c, name: v })} placeholder={c.type} testID="coverage-name" />
        {def.g.map((g, i) => (
          <Fold key={g.t} title={g.t} open={i === 0} testID={`coverage-fold-${i}`}>
            {g.f.map(([k, label, kind]) => kind === "date"
              ? <DateField key={k} label={label} value={c.data[k] || ""} onChange={set(k)} testID={`coverage-${k}`} />
              : <Field key={k} label={label} value={c.data[k] || ""} onChangeText={set(k)} multiline={kind === "multi"} testID={`coverage-${k}`} />)}
          </Fold>
        ))}
        <Fold title="Documentos" hint={c.id ? undefined : "Guarda la cobertura para adjuntar"} testID="coverage-fold-docs">
          {c.id ? <Docs refId={c.id} refType="coverage" cats={COVERAGE_DOCS} plus={acc.data?.plus} extractKind="policy" onExtract={def.g === PRIVATE ? setDraft : undefined} /> : <Txt v="caption">Primero guarda la cobertura.</Txt>}
        </Fold>
        {c.data.valid_until ? <Btn label="Crear recordatorio de vencimiento" small variant="secondary" icon="bell" testID="coverage-reminder" style={{ alignSelf: "flex-start", marginTop: space.sm }}
          onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", title: `Renovar o revisar: ${c.name || c.type}`, date: c.data.valid_until } })} /> : null}
        {c.id ? <Btn label={c.archived ? "Volver a activar" : "Archivar cobertura"} variant="ghost" icon="archive" onPress={() => save({ archived: !c.archived })} testID="coverage-archive" style={{ marginTop: space.md }} /> : null}
        <Txt v="caption" style={{ marginTop: space.md }}>Todos los campos son opcionales. AMODO no solicita contraseñas de aseguradoras ni está conectado con ellas.</Txt>
      </Screen>
    );
  }

  const active = (q.data || []).filter((x) => !x.archived);
  const archived = (q.data || []).filter((x) => x.archived);
  return (
    <Screen title="Mi cobertura médica" subtitle="Opcional. Puedes registrar una o varias" testID="coverage-screen" refreshing={q.isRefetching} onRefresh={q.refetch}
      footer={<Btn label="Agregar cobertura" icon="plus" onPress={() => setPick(true)} testID="coverage-add" />}
      overlay={
        <Sheet visible={pick} onClose={() => setPick(false)} title="¿Qué cobertura quieres registrar?" testID="coverage-type-sheet">
          <ChipRow>{TYPES.map((t) => <Chip key={t.t} label={t.t} onPress={() => { setPick(false); setC({ type: t.t, name: t.t === "Otra cobertura" ? "" : t.t, data: {} }); }} testID={`coverage-type-${t.t}`} />)}</ChipRow>
        </Sheet>
      }>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data ? <Loading /> : active.length === 0 && archived.length === 0 ? (
        <Empty icon="shield" title="Aún no registras coberturas" text="Seguro privado, IMSS, ISSSTE, una fundación o recursos propios: guarda aquí lo que te sirva tener a la mano." action="Agregar cobertura" onAction={() => setPick(true)} testID="coverage-empty" />
      ) : (
        <>
          {active.map((x) => (
            <Card key={x.id} tint={defOf(x.type).tint} onPress={() => setC({ ...x, data: x.data || {} })} style={{ marginBottom: space.sm, borderRadius: 24 }} testID={`coverage-card-${x.id}`}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Txt v="label">{x.type}</Txt>
                  <Txt v="h2">{x.name}</Txt>
                  {x.data.policy_number || x.data.affiliation ? <Txt v="caption">{x.data.policy_number ? "Póliza" : "Afiliación"} {mask(x.data.policy_number || x.data.affiliation)}</Txt> : null}
                  {x.data.valid_until ? <Txt v="caption">Vigente hasta el {fmtDate(x.data.valid_until)}</Txt> : null}
                  {x.data.phone ? <Txt v="caption">Contacto: {x.data.phone}</Txt> : null}
                </View>
                <Spot name="heart" size={52} pop={colors.surfaceSecondary} />
              </View>
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                <Btn label="Ver y editar" small onPress={() => setC({ ...x, data: x.data || {} })} testID={`coverage-edit-${x.id}`} />
                <Btn label="Gastos" small variant="secondary" onPress={() => router.push({ pathname: "/finances", params: { coverage: x.id } })} testID={`coverage-expenses-${x.id}`} />
              </View>
            </Card>
          ))}
          {archived.length ? <Section title="Archivadas">{archived.map((x, i) => <Row key={x.id} icon="archive" tint="sand" title={x.name} subtitle={x.type} onPress={() => setC({ ...x, data: x.data || {} })} last={i === archived.length - 1} />)}</Section> : null}
        </>
      )}
    </Screen>
  );
}
