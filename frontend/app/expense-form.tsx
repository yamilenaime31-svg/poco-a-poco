import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDate, money, today } from "@/src/constants";
import { CATEGORIES, DOC_CATS, Docs, Fold, METHODS, MODES, OTHER_SOURCES } from "@/src/finance/shared";
import { Reminders } from "@/src/finance/reminders";
import { DateField } from "@/src/pickers";
import { useToast } from "@/src/toast";
import { Badge, Btn, Chip, ChipRow, ErrorState, Field, Ic, IconBtn, Loading, Row, Screen, Sheet, SwitchRow, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const n = (v: any) => Math.max(0, Number(String(v ?? "").replace(",", ".")) || 0);
const sum = (l: any[] = []) => l.reduce((a, x) => a + n(x.amount), 0);
const INS: [string, string][] = [["deductible", "Deducible aplicado"], ["deductible_accum", "Deducible acumulado reconocido"], ["coinsurance", "Coaseguro aplicado"], ["covered", "Cubierto por la aseguradora"], ["not_covered", "No cubierto"], ["out_of_coverage", "Fuera de cobertura"], ["other", "Otros ajustes"]];
const CLAIM_TXT: [string, string][] = [["policy", "Número de póliza"], ["claim_no", "Número de siniestro"], ["folio", "Solicitud o folio"], ["owner_name", "Quién da seguimiento"], ["method", "Medio de recepción"]];
const LISTS: Record<string, string> = { payments: "Pago", deposits: "Depósito de reembolso", supports: "Apoyo recibido" };

/** One expense, in progressive sections: only the basics are required; everything else can be completed later. */
export default function ExpenseForm() {
  const p = useLocalSearchParams<{ id?: string; owner_id?: string; date?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const qs = p.owner_id ? `?owner_id=${p.owner_id}` : "";
  const acc = useApi<any>(`/finance/access${qs}`);
  const q = useApi<any>(p.id ? `/finance/expenses/${p.id}` : null);
  const meta = useApi<any>(`/finance/expenses${qs}`);
  const cov = useApi<any[]>(acc.data?.coverages ? `/coverages${qs}` : null);
  const treatments = useApi<any[]>(p.owner_id ? null : "/records/treatments");
  const [e, setE] = useState<any>(p.id ? null : { title: "", amount: "", category: "", date: p.date || today(), payments: [], sources: [], supports: [], insurance: {}, claim: null });
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState("");
  const [entry, setEntry] = useState<any>(null); // { list, item }
  const [draft, setDraft] = useState<any>(null);
  const [newItem, setNewItem] = useState("");
  const [editCats, setEditCats] = useState(false);
  useEffect(() => {
    if (q.data && !e) setE({ ...q.data, amount: String(q.data.amount ?? ""), payments: q.data.calc.payments, sources: q.data.sources || [], supports: q.data.supports || [], insurance: q.data.insurance || {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);
  const a = acc.data || {};
  const canEdit = p.id ? a.edit : a.add;
  const canClaim = a.owner || a.claims;
  const set = (k: string) => (v: any) => setE((x: any) => ({ ...x, [k]: v }));
  const setClaim = (k: string) => (v: any) => setE((x: any) => ({ ...x, claim: { ...x.claim, [k]: v } }));

  const save = async (back = true) => {
    if (!e.title.trim()) return toast.show("Escribe el concepto del gasto", "error");
    setSaving(true);
    try {
      const body = { ...e, owner_id: p.owner_id, amount: n(e.amount), calc: undefined, log: undefined };
      if (!canClaim) delete body.claim;
      const r = await api(p.id ? `/finance/expenses/${p.id}` : "/finance/expenses", { method: p.id ? "PUT" : "POST", body });
      invalidate();
      toast.show("Gasto guardado");
      if (!p.id) router.replace({ pathname: "/expense-form", params: { id: r.id, owner_id: p.owner_id } });
      else if (back) router.back();
    } catch (err: any) {
      toast.show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    await api(`/finance/expenses/${p.id}`, { method: "DELETE" }).catch((err) => toast.show(err.message, "error"));
    invalidate();
    router.back();
  };
  const listOf = (k: string) => (k === "deposits" ? e.claim?.deposits || [] : e[k] || []);
  const writeList = (k: string, l: any[]) => (k === "deposits" ? setClaim("deposits")(l) : set(k)(l));
  const saveEntry = () => {
    const it = { ...entry.item, amount: n(entry.item.amount) };
    if (!it.amount) return toast.show("Escribe el importe", "error");
    const l = listOf(entry.list);
    writeList(entry.list, it.id ? l.map((x: any) => (x.id === it.id ? it : x)) : [...l, { ...it, id: `n${Date.now()}` }]);
    setEntry(null);
  };
  const toggleSource = (s: { coverage_id: string; label: string }) => set("sources")(e.sources.some((x: any) => x.label === s.label) ? e.sources.filter((x: any) => x.label !== s.label) : [...e.sources, { ...s, mode: e.sources[0]?.mode || "" }]);
  const applyDraft = (k: string, v: any) => {
    if (k === "amount") set("amount")(String(v));
    else if (k === "folio") setE((x: any) => ({ ...x, notes: [x.notes, `Folio: ${v}`].filter(Boolean).join(" · ") }));
    else if (["provider", "date", "title", "currency"].includes(k)) set(k)(String(v));
    else if (k === "category" && CATEGORIES.includes(String(v))) set("category")(v);
    setDraft((d: any) => { const x = { ...d }; delete x[k]; return x; });
  };

  if (q.isError || acc.isError) return <Screen title="Gasto"><ErrorState message={((q.error || acc.error) as Error)?.message} onRetry={() => q.refetch()} /></Screen>;
  if (!e || !acc.data) return <Screen title="Gasto"><Loading /></Screen>;
  const myCats: string[] = [...new Set([...(meta.data?.categories || []), ...(e.category ? [e.category] : [])])].filter((x) => !CATEGORIES.includes(x));
  const useCustom = () => { if (newItem.trim()) { set("category")(newItem.trim()); setNewItem(""); setSheet(""); } };
  const forget = async (name: string) => {
    await api(`/finance/categories?name=${encodeURIComponent(name)}`, { method: "DELETE" }).catch((err) => toast.show(err.message, "error"));
    if (e.category === name) set("category")("");
    meta.refetch();
  };
  const otherClaims: string[] = [...new Set((meta.data?.items || []).map((x: any) => String(x.claim?.claim_no || "").trim()).filter((x: string) => x && x !== e.claim?.claim_no))] as string[];
  const total = n(e.amount);
  const own = sum(e.payments.filter((x: any) => x.source !== "direct"));
  const direct = sum(e.payments.filter((x: any) => x.source === "direct"));
  const pending = Math.max(0, total - n(e.discount) - own - direct);
  const c = e.claim;
  const moneyList = (k: string, label: string) => (
    <View style={{ marginBottom: space.sm }}>
      {listOf(k).map((x: any) => (
        <Row key={x.id} icon={k === "payments" && x.source === "direct" ? "building-2" : "banknote"} tint={k === "payments" ? "sage" : "butter"} title={money(n(x.amount))} last
          subtitle={[k === "payments" ? (x.source === "direct" ? "Pago directo de aseguradora o institución" : "Pago propio") : "", x.date ? fmtDate(x.date) : "", x.method, x.by || x.from].filter(Boolean).join(" · ")}
          onPress={canEdit ? () => setEntry({ list: k, item: { ...x, amount: String(x.amount) } }) : undefined} testID={`expense-${k}-${x.id}`} />
      ))}
      {canEdit ? <Btn label={label} small variant="secondary" icon="plus" onPress={() => setEntry({ list: k, item: { amount: k === "payments" && pending ? String(pending) : "", date: today(), source: "own" } })} testID={`expense-add-${k}`} style={{ alignSelf: "flex-start" }} /> : null}
    </View>
  );

  return (
    <Screen title={p.id ? "Gasto" : "Nuevo gasto"} subtitle={p.id && e.created_by_name ? `Registrado por ${e.created_by_name}` : "Solo el concepto es obligatorio"} testID="expense-form"
      footer={canEdit ? <Btn label="Guardar" loading={saving} onPress={() => save()} testID="expense-save" /> : undefined}
      overlay={
        <>
          <Sheet visible={sheet === "category"} onClose={() => setSheet("")} title="Categoría" testID="expense-category-sheet">
            {myCats.length ? (
              <View style={{ marginBottom: space.md }} testID="expense-my-categories">
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Txt v="label" color={colors.onSurface} style={{ flex: 1 }}>Tus categorías</Txt>
                  {a.owner ? <Btn label={editCats ? "Listo" : "Quitar alguna"} small variant="ghost" onPress={() => setEditCats(!editCats)} testID="expense-category-edit" /> : null}
                </View>
                <ChipRow>{myCats.map((x) => <Chip key={x} label={x} icon={editCats ? "x" : undefined} selected={!editCats && e.category === x} onPress={() => (editCats ? forget(x) : (set("category")(x), setSheet("")))} testID={`expense-category-${x}`} />)}</ChipRow>
              </View>
            ) : null}
            <ChipRow>{CATEGORIES.map((x) => <Chip key={x} label={x} selected={e.category === x} onPress={() => { set("category")(x); setSheet(""); }} testID={`expense-category-${x}`} />)}</ChipRow>
            <Field label="O escribe una propia" hint="Se guarda con el gasto para que puedas elegirla después" value={newItem} onChangeText={setNewItem} onSubmitEditing={useCustom} returnKeyType="done" testID="expense-category-custom" style={{ marginTop: space.md }} />
            {newItem.trim() ? <Btn label={`Usar «${newItem.trim()}»`} onPress={useCustom} testID="expense-category-custom-use" /> : null}
          </Sheet>
          <Sheet visible={sheet === "status"} onClose={() => setSheet("")} title="Estado del trámite" testID="expense-status-sheet">
            <Txt v="caption" style={{ marginBottom: space.sm }}>Tú lo actualizas: AMODO no está conectado con la aseguradora. Se guarda la fecha del cambio.</Txt>
            <ChipRow>{(meta.data?.claim_states || []).map((s: string) => <Chip key={s} label={s} selected={c?.status === s} onPress={() => { setClaim("status")(s); setSheet(""); }} testID={`expense-status-${s}`} />)}</ChipRow>
          </Sheet>
          <Sheet visible={!!entry} onClose={() => setEntry(null)} title={LISTS[entry?.list] || ""} testID="expense-entry-sheet">
            <Field label="Importe" value={entry?.item.amount || ""} onChangeText={(v) => setEntry({ ...entry, item: { ...entry.item, amount: v } })} keyboardType="decimal-pad" testID="expense-entry-amount" />
            {entry?.list === "payments" ? <ChipRow>{[["own", "Lo pagué yo o mi red"], ["direct", "Lo pagó la aseguradora o institución"]].map(([k, l]) => <Chip key={k} label={l} selected={(entry.item.source || "own") === k} onPress={() => setEntry({ ...entry, item: { ...entry.item, source: k } })} testID={`expense-entry-source-${k}`} />)}</ChipRow> : null}
            <View style={{ height: space.md }} />
            <DateField label="Fecha" value={entry?.item.date || ""} onChange={(v) => setEntry({ ...entry, item: { ...entry.item, date: v } })} testID="expense-entry-date" />
            <ChipRow>{METHODS.map((m) => <Chip key={m} label={m} selected={entry?.item.method === m} onPress={() => setEntry({ ...entry, item: { ...entry.item, method: m } })} testID={`expense-entry-method-${m}`} />)}</ChipRow>
            <Field label={entry?.list === "supports" ? "De quién" : "Quién lo hizo (opcional)"} value={entry?.item[entry?.list === "supports" ? "from" : "by"] || ""} onChangeText={(v) => setEntry({ ...entry, item: { ...entry.item, [entry.list === "supports" ? "from" : "by"]: v } })} testID="expense-entry-by" style={{ marginTop: space.md }} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              {entry?.item.id ? <Btn label="Quitar" variant="secondary" style={{ flex: 1 }} onPress={() => { writeList(entry.list, listOf(entry.list).filter((x: any) => x.id !== entry.item.id)); setEntry(null); }} testID="expense-entry-remove" /> : null}
              <Btn label="Listo" style={{ flex: 1.4 }} onPress={saveEntry} testID="expense-entry-save" />
            </View>
          </Sheet>
          <Sheet visible={!!draft} onClose={() => setDraft(null)} title="Datos encontrados" testID="expense-draft-sheet">
            <Txt v="caption" style={{ marginBottom: space.sm }}>Borrador creado con IA a partir del documento. Toca solo los datos que quieras usar; nada se guarda hasta que presiones Guardar.</Txt>
            {Object.entries(draft || {}).map(([k, v]) => <Row key={k} title={String(v)} subtitle={k} onPress={() => applyDraft(k, v)} testID={`expense-draft-${k}`} right={<Badge label="Usar" tint="lavender" />} last />)}
            <Btn label="Listo" onPress={() => setDraft(null)} testID="expense-draft-done" style={{ marginTop: space.md }} />
          </Sheet>
          <Sheet visible={sheet === "delete"} onClose={() => setSheet("")} title="¿Eliminar este gasto?" testID="expense-delete-sheet">
            <Btn label="Sí, eliminar" variant="danger" onPress={remove} testID="expense-delete-confirm" />
          </Sheet>
        </>
      }>
      <Field label="Concepto" value={e.title} onChangeText={set("title")} editable={!!canEdit} testID="expense-title" />
      <Field label={`Importe total (${e.currency || "MXN"})`} value={e.amount} onChangeText={set("amount")} keyboardType="decimal-pad" editable={!!canEdit} testID="expense-amount" />
      <Row icon="tag" tint="sky" title={e.category || "Elegir categoría"} subtitle="Categoría" onPress={canEdit ? () => setSheet("category") : undefined} testID="expense-category" last />
      <View style={{ height: space.md }} />
      <DateField label="Fecha del gasto" value={e.date || ""} onChange={set("date")} testID="expense-date" />

      <Fold title="Pagos" hint={`Pagado ${money(own)}${direct ? ` · pago directo ${money(direct)}` : ""} · pendiente ${money(pending)}`} open={!!p.id} testID="expense-fold-payments" tint="sageSoft">
        {moneyList("payments", "Agregar pago")}
        {pending > 0 ? <DateField label="Fecha límite de pago (opcional)" value={e.due_date || ""} onChange={set("due_date")} testID="expense-due-date" /> : null}
      </Fold>

      <Fold title="¿Cómo se cubre este gasto?" hint={e.sources.map((s: any) => s.label).join(", ") || "Opcional. Puedes elegir varias o dejarlo para después"} testID="expense-fold-sources" tint="lavenderSoft">
        <ChipRow>
          {(cov.data || []).filter((x) => !x.archived).map((x) => <Chip key={x.id} label={x.name} selected={e.sources.some((s: any) => s.label === x.name)} onPress={() => toggleSource({ coverage_id: x.id, label: x.name })} testID={`expense-source-${x.id}`} />)}
          {OTHER_SOURCES.map((x) => <Chip key={x} label={x} selected={e.sources.some((s: any) => s.label === x)} onPress={() => toggleSource({ coverage_id: "", label: x })} testID={`expense-source-${x}`} />)}
        </ChipRow>
        {a.owner && (cov.data || []).length === 0 ? <Btn label="Registrar una cobertura" small variant="ghost" icon="shield" onPress={() => router.push("/coverage")} testID="expense-go-coverage" style={{ alignSelf: "flex-start" }} /> : null}
        {e.sources.length ? <><Txt v="label" color={colors.onSurface} style={{ marginVertical: space.sm }}>Modalidad</Txt><ChipRow>{MODES.map((m) => <Chip key={m} label={m} selected={e.sources[0]?.mode === m} onPress={() => set("sources")(e.sources.map((s: any) => ({ ...s, mode: m })))} testID={`expense-mode-${m}`} />)}</ChipRow></> : null}
      </Fold>

      {canClaim ? (
        <Fold title="Reembolso" hint={c ? `${c.status || "Pendiente de preparar"} · recibido ${money(sum(c.deposits))}` : "Actívalo si vas a presentar este gasto"} open={!!c} testID="expense-fold-claim" tint="butterSoft">
          <SwitchRow label="Presentaré este gasto para reembolso" value={!!c} onValueChange={(v) => set("claim")(v ? { status: "Pendiente de preparar", requested: "", deposits: [], checklist: [], history: [] } : null)} testID="expense-claim-switch" />
          {c ? (
            <>
              <Row icon="git-commit-horizontal" tint="butter" title={c.status || "Pendiente de preparar"} subtitle="Estado del trámite · toca para cambiar" onPress={() => setSheet("status")} testID="expense-claim-status" last />
              {(c.history || []).map((h: any, i: number) => (
                <View key={i} style={{ flexDirection: "row", gap: space.sm, alignItems: "center", marginLeft: space.lg, minHeight: 28 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onSurface }} />
                  <Txt v="caption" color={colors.onSurface}>{fmtDate(h.date)} · {h.status} · {h.by}</Txt>
                </View>
              ))}
              <View style={{ height: space.md }} />
              {[["requested", "Importe solicitado"], ["authorized", "Importe autorizado"], ["rejected", "Importe rechazado o no reconocido"]].map(([k, l]) => <Field key={k} label={l} value={String(c[k] ?? "")} onChangeText={setClaim(k)} keyboardType="decimal-pad" testID={`expense-claim-${k}`} />)}
              {n(c.authorized) ? <Txt v="caption" color={colors.onSurface} style={{ marginBottom: space.md }}>Por recibir (estimado): {money(Math.max(0, n(c.authorized) - sum(c.deposits)))}</Txt> : null}
              <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>Depósitos recibidos</Txt>
              {moneyList("deposits", "Agregar depósito")}
              <Fold title="Datos del trámite" testID="expense-fold-claim-data">
                {(cov.data || []).length ? <><Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>Aseguradora o institución</Txt><ChipRow>{(cov.data || []).map((x) => <Chip key={x.id} label={x.name} selected={c.coverage_id === x.id} onPress={() => setE((s: any) => ({ ...s, claim: { ...s.claim, coverage_id: x.id, policy: s.claim.policy || x.data?.policy_number || "" } }))} testID={`expense-claim-cov-${x.id}`} />)}</ChipRow><View style={{ height: space.md }} /></> : null}
                {CLAIM_TXT.map(([k, l]) => <Field key={k} label={l} value={c[k] || ""} onChangeText={setClaim(k)} testID={`expense-claim-${k}`} hint={k === "claim_no" ? "Los gastos con el mismo número se agrupan en Gastos" : undefined} />)}
                {otherClaims.length ? <><Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>Usar un siniestro que ya registraste</Txt><ChipRow>{otherClaims.map((x) => <Chip key={x} label={x} onPress={() => setClaim("claim_no")(x)} testID={`expense-claim-no-${x}`} />)}</ChipRow><View style={{ height: space.md }} /></> : null}
                {[["filed_date", "Fecha de presentación"], ["expected_date", "Fecha estimada de resolución (la que te dieron)"], ["authorized_date", "Fecha de autorización"]].map(([k, l]) => <DateField key={k} label={l} value={c[k] || ""} onChange={setClaim(k)} testID={`expense-claim-${k}`} />)}
                <Field label="Motivo de rechazo (si aplica)" value={c.reject_reason || ""} onChangeText={setClaim("reject_reason")} testID="expense-claim-reject_reason" />
                <Field label="Observaciones" value={c.notes || ""} onChangeText={setClaim("notes")} multiline testID="expense-claim-notes" />
              </Fold>
              <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>Mi lista de documentos</Txt>
              <Txt v="caption" style={{ marginBottom: space.sm }}>Cada aseguradora pide cosas distintas: arma la lista según tu caso. Toca el estado para cambiarlo.</Txt>
              {(c.checklist || []).map((i: any) => (
                <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 }}>
                  <Txt style={{ flex: 1 }}>{i.label}</Txt>
                  <Pressable testID={`expense-check-${i.label}`} onPress={() => { const st = meta.data?.doc_states || []; setClaim("checklist")(c.checklist.map((x: any) => (x.id === i.id ? { ...x, status: st[(st.indexOf(x.status) + 1) % st.length] } : x))); }} style={{ minHeight: 44, justifyContent: "center" }}>
                    <Badge label={i.status} tint={i.status === "Entregado" || i.status === "Disponible" ? "sage" : i.status === "Requiere corrección" ? "coral" : "sand"} />
                  </Pressable>
                  <IconBtn icon="x" onPress={() => setClaim("checklist")(c.checklist.filter((x: any) => x.id !== i.id))} testID={`expense-check-remove-${i.label}`} />
                </View>
              ))}
              <ChipRow>{DOC_CATS.filter((d) => !(c.checklist || []).some((x: any) => x.label === d)).slice(0, 6).map((d) => <Chip key={d} label={d} icon="plus" onPress={() => setClaim("checklist")([...(c.checklist || []), { id: `n${Date.now()}`, label: d, status: "Pendiente" }])} testID={`expense-check-add-${d}`} />)}</ChipRow>
              <Field label="Otro requisito" value={newItem} onChangeText={setNewItem} returnKeyType="done" onSubmitEditing={() => { if (newItem.trim()) { setClaim("checklist")([...(c.checklist || []), { id: `n${Date.now()}`, label: newItem.trim(), status: "Pendiente" }]); setNewItem(""); } }} testID="expense-check-custom" style={{ marginTop: space.md }} />
            </>
          ) : null}
        </Fold>
      ) : null}

      {c || e.sources.some((s: any) => s.coverage_id) ? (
        <Fold title="Deducible y coaseguro" hint="Captura lo que te informó tu aseguradora. AMODO no lo calcula" testID="expense-fold-insurance">
          {INS.map(([k, l]) => <Field key={k} label={l} value={String(e.insurance[k] ?? "")} onChangeText={(v) => set("insurance")({ ...e.insurance, [k]: v })} keyboardType="decimal-pad" testID={`expense-ins-${k}`} />)}
        </Fold>
      ) : null}

      <Fold title="Más detalles" hint="Proveedor, tratamiento, descuentos, apoyos y notas" testID="expense-fold-more">
        <Field label="Hospital, farmacia, médico o proveedor" value={e.provider || ""} onChangeText={set("provider")} testID="expense-provider" />
        <Field label="Quién hizo el gasto" value={e.spent_by || ""} onChangeText={set("spent_by")} testID="expense-spent_by" />
        {(treatments.data || []).length ? <><Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>Tratamiento relacionado</Txt><ChipRow>{(treatments.data || []).map((t) => <Chip key={t.id} label={t.name} selected={e.treatment_id === t.id} onPress={() => set("treatment_id")(e.treatment_id === t.id ? "" : t.id)} testID={`expense-treatment-${t.id}`} />)}</ChipRow><View style={{ height: space.md }} /></> : null}
        <Field label="Descuentos aplicados" value={String(e.discount ?? "")} onChangeText={set("discount")} keyboardType="decimal-pad" testID="expense-discount" />
        <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>Apoyos económicos recibidos para este gasto</Txt>
        {moneyList("supports", "Agregar apoyo")}
        <Field label="Notas" value={e.notes || ""} onChangeText={set("notes")} multiline testID="expense-notes" />
      </Fold>

      <Fold title="Documentos y comprobantes" hint={p.id ? undefined : "Guarda el gasto para adjuntar"} testID="expense-fold-docs">
        {!p.id ? <Btn label="Guardar y adjuntar" small variant="secondary" onPress={() => save(false)} testID="expense-save-attach" style={{ alignSelf: "flex-start" }} /> : a.docs || a.owner ? <Docs refId={p.id} cats={DOC_CATS} canAttach={a.attach || a.owner} plus={a.plus} extractKind="receipt" onExtract={canEdit ? setDraft : undefined} /> : <Txt v="caption">No tienes permiso para ver los documentos de este gasto.</Txt>}
      </Fold>

      <Fold title="Recordatorios" hint={p.id ? "Con fecha y hora, para pagos, documentos y seguimiento" : "Guarda el gasto para programar"} testID="expense-fold-reminders">
        {p.id ? <Reminders expenseId={p.id} expenseTitle={e.title} ownerId={p.owner_id} canAdd={!!canEdit || canClaim} defaultDate={c?.expected_date || e.due_date} /> : <Btn label="Guardar y programar" small variant="secondary" onPress={() => save(false)} testID="expense-save-remind" style={{ alignSelf: "flex-start" }} />}
      </Fold>

      {(e.log || []).length ? <Fold title="Historial de cambios" testID="expense-fold-log">{e.log.map((l: any) => <Txt key={l.id} v="caption" style={{ marginBottom: 2 }}>{fmtDate(l.at.slice(0, 10))} · {l.by_name} · {l.action}</Txt>)}</Fold> : null}
      {p.id && canEdit ? <Btn label="Eliminar gasto" variant="ghost" icon="trash-2" onPress={() => setSheet("delete")} testID="expense-delete" style={{ marginTop: space.sm }} /> : null}
      <View style={{ flexDirection: "row", gap: 6, marginTop: space.md }}><Ic name="shield-check" size={14} color={colors.muted} /><Txt v="caption" style={{ flex: 1 }}>AMODO no pide datos de tarjetas ni contraseñas de aseguradoras, y no envía nada a terceros.</Txt></View>
    </Screen>
  );
}
