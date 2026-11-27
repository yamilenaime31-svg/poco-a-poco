import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, useApi } from "@/src/api";
import { Spot } from "@/src/art";
import { HBars, WeekBars } from "@/src/components/bars";
import { MONTHS_LONG, addDays, fmtDate, money } from "@/src/constants";
import { PlusTag } from "@/src/components/plus-gate";
import { CashFlow } from "@/src/finance/cashflow";
import { ClaimGroups, claimNo } from "@/src/finance/claims";
import { fileUrl } from "@/src/finance/shared";
import { WeekShareSheet } from "@/src/finance/week-share";
import { useToast } from "@/src/toast";
import { Badge, Btn, Chip, ChipRow, Empty, ErrorState, Loading, Row, Screen, Section, Sheet, SwitchRow, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const KEYS = ["total", "paid_own", "direct", "pending_pay", "requested", "authorized", "received", "pending_receive", "supports", "net"];
const INFO: Record<string, { l: string; f: string; tint: string }> = {
  net: { l: "Desembolso neto actual", f: "Lo que tú o tu red han pagado, menos reembolsos y apoyos que ya recibiste. Lo solicitado o autorizado no se resta hasta recibirlo.", tint: "lavender" },
  total: { l: "Gastos registrados", f: "Suma del importe total de cada gasto, sin importar quién lo pagó.", tint: "sky" },
  paid_own: { l: "Pagado por ti o tu red", f: "Suma de los pagos marcados como propios.", tint: "sage" },
  pending_pay: { l: "Pagos pendientes", f: "Importe total menos descuentos, pagos propios y pagos directos de cada gasto.", tint: "coral" },
  direct: { l: "Pago directo de terceros", f: "Lo que una aseguradora o institución pagó directamente al proveedor. No cuenta como dinero tuyo.", tint: "butter" },
  requested: { l: "Reembolso solicitado", f: "Suma de los importes presentados para revisión.", tint: "mauve" },
  authorized: { l: "Reembolso autorizado", f: "Suma de los importes que registraste como aprobados.", tint: "mauve" },
  received: { l: "Reembolso recibido", f: "Suma de los depósitos que registraste como recibidos.", tint: "sage" },
  pending_receive: { l: "Reembolso por recibir", f: "Autorizado menos recibido, en trámites que siguen abiertos. Es una estimación.", tint: "butter" },
  supports: { l: "Apoyos recibidos", f: "Apoyos económicos que registraste en cada gasto.", tint: "sky" },
};
const PERM_LABEL: [string, string][] = [["view", "Consultar gastos"], ["add", "Registrar gastos"], ["edit", "Editar movimientos"], ["coverages", "Consultar coberturas"], ["docs", "Consultar documentos"], ["attach", "Adjuntar documentos"], ["claims", "Administrar reembolsos"], ["reports", "Generar reportes"]];
const REPORTS: [string, string][] = [["financial", "Reporte financiero"], ["treatment", "Gastos por tratamiento"], ["claims", "Reporte de reembolsos"], ["dossier", "Expediente de documentación (ZIP)"]];

/** Gastos: a personal financial view of the process. Real amounts and estimates are always kept apart. */
export default function Finances() {
  const p = useLocalSearchParams<{ owner_id?: string; coverage?: string; week?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const qs = p.owner_id ? `?owner_id=${p.owner_id}` : "";
  const q = useApi<any>(`/finance/expenses${qs}`);
  const acc = useApi<any>(`/finance/access${qs}`);
  const cov = useApi<any[]>(acc.data?.coverages ? `/coverages${qs}` : null);
  const perms = useApi<any[]>(acc.data?.owner ? "/finance/permissions" : null);
  const [f, setF] = useState<any>({ period: 0, category: "", coverage: p.coverage || "", pay: "", claim: "", person: "", claimNo: "" });
  const [sheet, setSheet] = useState<"" | "filters" | "perms" | "report" | "week">(p.week ? "week" : "");
  const [info, setInfo] = useState("");
  const [rep, setRep] = useState<any>({ type: "financial", hide_sensitive: true, busy: false });
  const a = acc.data || {};

  const items: any[] = useMemo(() => (q.data?.items || []).filter((e: any) => {
    const c = e.calc;
    if (f.period && e.when < addDays(-f.period)) return false;
    if (f.category && (e.category || "Otros gastos") !== f.category) return false;
    if (f.coverage && !(e.sources || []).some((s: any) => s.coverage_id === f.coverage) && e.claim?.coverage_id !== f.coverage) return false;
    if (f.pay === "Pagado" && c.pending_pay > 0) return false;
    if (f.pay === "Pendiente" && c.pending_pay === 0) return false;
    if (f.claim === "Con reembolso" && !c.has_claim) return false;
    if (f.claim && f.claim !== "Con reembolso" && c.claim_status !== f.claim) return false;
    if (f.claimNo && claimNo(e) !== f.claimNo) return false;
    if (f.person && (e.spent_by || e.paid_by || "Sin especificar") !== f.person) return false;
    return true;
  }), [q.data, f]);
  const t = useMemo(() => {
    const s: any = {};
    KEYS.forEach((k) => (s[k] = items.reduce((n, e) => n + e.calc[k], 0)));
    s.estimated = s.net + s.pending_pay - s.pending_receive;
    return s;
  }, [items]);
  const group = (key: (e: any) => string, val = "total") => Object.entries(items.reduce((m: any, e) => ({ ...m, [key(e)]: (m[key(e)] || 0) + e.calc[val] }), {})).map(([label, value]) => ({ label, value: value as number })).filter((r) => r.value > 0).sort((x, y) => y.value - x.value);
  const months = useMemo(() => [...new Set(items.map((e) => e.when.slice(0, 7)))].sort().slice(-6).map((m) => ({ start: m, label: MONTHS_LONG[Number(m.slice(5)) - 1].slice(0, 3), total: items.filter((e) => e.when.startsWith(m)).reduce((n, e) => n + e.calc.total, 0) })), [items]);
  const people = [...new Set((q.data?.items || []).map((e: any) => e.spent_by || e.paid_by || "Sin especificar"))] as string[];
  const active = Object.values(f).filter(Boolean).length;
  const setPerm = async (cid: string, cur: any, k: string, v: boolean) => {
    try {
      await api(`/finance/permissions/${cid}`, { method: "PUT", body: { perms: { ...cur, [k]: v } } });
      perms.refetch();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  const openExpense = (id: string) => router.push({ pathname: "/expense-form", params: { id, owner_id: p.owner_id } });
  const report = async (claim?: string) => {
    if (!a.plus) return router.push("/plus");
    setRep({ ...rep, busy: true });
    try {
      const body = claim ? { type: "claim", claim_no: claim, hide_sensitive: false, owner_id: p.owner_id }
        : { type: rep.type, hide_sensitive: rep.hide_sensitive, owner_id: p.owner_id, coverage_id: f.coverage, claim_no: f.claimNo, categories: f.category ? [f.category] : [], ...(f.period ? { start: addDays(-f.period), end: addDays(0) } : {}) };
      const r = await api("/finance/reports", { method: "POST", body });
      await Linking.openURL(fileUrl(r.path));
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setRep((x: any) => ({ ...x, busy: false }));
    }
  };

  return (
    <Screen title="Gastos" subtitle="Lo que has pagado, recuperado y lo que sigue pendiente" testID="finances-screen" refreshing={q.isRefetching} onRefresh={q.refetch}
      footer={a.add ? <Btn label="Registrar gasto" icon="plus" onPress={() => router.push({ pathname: "/expense-form", params: { owner_id: p.owner_id } })} testID="finances-add" /> : undefined}
      overlay={
        <>
          <Sheet visible={sheet === "filters"} onClose={() => setSheet("")} title="Filtros" testID="finances-filters-sheet">
            {([["Periodo", "period", [[0, "Todo"], [30, "30 días"], [90, "90 días"], [365, "Un año"]]], ["Estado de pago", "pay", [["", "Todos"], ["Pagado", "Pagado"], ["Pendiente", "Pendiente"]]],
              ["Reembolso", "claim", [["", "Todos"], ["Con reembolso", "Con reembolso"], ...(q.data?.claim_states || []).map((s: string) => [s, s])]],
              ["Categoría", "category", [["", "Todas"], ...group((e) => e.category || "Otros gastos").map((r) => [r.label, r.label])]],
              ["Cobertura", "coverage", [["", "Todas"], ...(cov.data || []).map((c) => [c.id, c.name])]], ["Persona", "person", [["", "Todas"], ...people.map((x) => [x, x])]]] as any[]).map(([label, key, opts]) => (
              <View key={key} style={{ marginBottom: space.md }}>
                <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>{label}</Txt>
                <ChipRow>{opts.map(([v, l]: any) => <Chip key={String(v)} label={l} selected={f[key] === v} onPress={() => setF({ ...f, [key]: v })} testID={`finances-filter-${key}-${v}`} />)}</ChipRow>
              </View>
            ))}
            <Btn label="Ver resultados" onPress={() => setSheet("")} testID="finances-filters-done" />
          </Sheet>
          <Sheet visible={!!info} onClose={() => setInfo("")} title={INFO[info]?.l || ""} testID="finances-info-sheet">
            <Txt>{INFO[info]?.f}</Txt>
            <Txt v="label" color={colors.onSurface} style={{ marginTop: space.md }}>Movimientos que lo forman</Txt>
            {items.filter((e) => e.calc[info] > 0).slice(0, 12).map((e, i, all) => <Row key={e.id} title={e.title} subtitle={`${fmtDate(e.when)} · ${money(e.calc[info])}`} onPress={() => { setInfo(""); router.push({ pathname: "/expense-form", params: { id: e.id, owner_id: p.owner_id } }); }} last={i === all.length - 1} />)}
          </Sheet>
          <Sheet visible={sheet === "perms"} onClose={() => setSheet("")} title="Quién puede ayudarte con esto" testID="finances-perms-sheet">
            <Txt v="caption" style={{ marginBottom: space.sm }}>Vincular una cuenta no da acceso a tus gastos ni documentos. Tú decides cada permiso.</Txt>
            {(perms.data || []).length === 0 ? <Txt v="caption">Aún no tienes personas vinculadas.</Txt> : (perms.data || []).map((c) => (
              <View key={c.caregiver_id} style={{ marginBottom: space.md }}>
                <Txt v="title">{c.name}</Txt>
                {PERM_LABEL.map(([k, l]) => <SwitchRow key={k} label={l} value={c.perms[k]} onValueChange={(v) => setPerm(c.caregiver_id, c.perms, k, v)} testID={`finances-perm-${k}-${c.caregiver_id}`} />)}
              </View>
            ))}
          </Sheet>
          <WeekShareSheet visible={sheet === "week"} onClose={() => setSheet("")} people={perms.data || []} />
          <Sheet visible={sheet === "report"} onClose={() => setSheet("")} title="Reportes y expediente" testID="finances-report-sheet">
            <PlusTag why="Reportes y expedientes en PDF, parte de tu membresía." testID="finances-report-plus" style={{ marginTop: 0, marginBottom: space.sm }} />
            <Txt v="caption" style={{ marginBottom: space.sm }}>Usa los filtros activos (periodo, categoría, cobertura, siniestro). Para el reporte general de tu proceso, entra a Mi proceso.</Txt>
            <ChipRow>{REPORTS.map(([k, l]) => <Chip key={k} label={l} selected={rep.type === k} onPress={() => setRep({ ...rep, type: k })} testID={`finances-report-${k}`} />)}</ChipRow>
            <SwitchRow label="Ocultar números de siniestro y folio" value={rep.hide_sensitive} onValueChange={(v) => setRep({ ...rep, hide_sensitive: v })} testID="finances-report-hide" />
            <Txt v="caption" style={{ marginVertical: space.sm }}>Incluirá {items.filter((e) => rep.type === "financial" || rep.type === "treatment" || e.calc.has_claim).length} movimiento(s). Se descarga en tu dispositivo; AMODO no lo envía a nadie.</Txt>
            <Btn label="Generar y descargar" icon="download" loading={rep.busy} onPress={() => report()} testID="finances-report-generate" />
          </Sheet>
        </>
      }>
      {q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !q.data ? <Loading /> : (
        <>
          <ChipRow>
            <Chip label={active ? `Filtros (${active})` : "Filtros"} icon="sliders-horizontal" selected={!!active} onPress={() => setSheet("filters")} testID="finances-filters" />
            {f.claimNo ? <Chip label={`Siniestro ${f.claimNo} ✕`} selected onPress={() => setF({ ...f, claimNo: "" })} testID="finances-claim-clear" /> : null}
            {a.coverages ? <Chip label="Mi cobertura" icon="shield" onPress={() => router.push("/coverage")} testID="finances-coverage" /> : null}
            {a.owner ? <Chip label="Permisos" icon="users" onPress={() => setSheet("perms")} testID="finances-perms" /> : null}
            {a.owner ? <Chip label="Compartir semana" icon="send" onPress={() => setSheet("week")} testID="finances-week-share" /> : null}
            {a.reports ? <Chip label="Reportes · Plus" icon="file-text" onPress={() => (a.plus ? setSheet("report") : router.push("/plus"))} testID="finances-reports" /> : null}
          </ChipRow>
          {(q.data.items || []).length === 0 ? <Empty icon="wallet" title="Aún no hay gastos" text="Registra un gasto cuando quieras. No necesitas seguro ni cobertura para usar esta sección." testID="finances-empty" /> : (
            <>
              <Pressable onPress={() => setInfo("net")} testID="finances-net" style={[styles.hero, { backgroundColor: colors.lavender }]}>
                <View style={{ flex: 1 }}>
                  <Txt v="label" color={colors.onSurface}>Desembolso neto actual</Txt>
                  <Txt v="display">{money(t.net)}</Txt>
                  {t.pending_pay || t.pending_receive ? <Txt v="caption" color={colors.onSurface} testID="finances-estimate">Gasto final estimado: {money(t.estimated)} · no garantizado</Txt> : null}
                </View>
                <Spot name="expenses" size={64} pop={colors.butter} />
              </Pressable>
              <View style={styles.bento} testID="finances-tiles">
                {["total", "paid_own", "pending_pay", "direct", "requested", "authorized", "received", "pending_receive", "supports"].filter((k) => k === "total" || k === "paid_own" || k === "pending_pay" || t[k] > 0).map((k) => (
                  <Pressable key={k} onPress={() => setInfo(k)} testID={`finances-tile-${k}`} style={({ pressed }) => [styles.tile, { backgroundColor: (colors as any)[INFO[k].tint], transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                    <Txt v="title" numberOfLines={1} style={money(t[k]).length > 13 ? { fontSize: 13, letterSpacing: -0.3 } : undefined}>{money(t[k]).replace(" MXN", "")}</Txt>
                    <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12, lineHeight: 15 }}>{INFO[k].l}{k === "pending_receive" ? " · estimado" : ""}</Txt>
                  </Pressable>
                ))}
              </View>
              {months.length > 1 ? <Section title="A lo largo del tiempo"><WeekBars weeks={months} field="total" testID="finances-months" /></Section> : null}
              <Section title="Por categoría" testID="finances-categories">
                <HBars rows={group((e) => e.category || "Otros gastos")} format={money} onPress={(l) => setF({ ...f, category: f.category === l ? "" : l })} testID="finances-cat" />
              </Section>
              <ClaimGroups items={q.data.items} selected={f.claimNo} onFilter={(no) => setF({ ...f, claimNo: no })} onOpen={openExpense} onReport={report} canReport={a.reports} plus={a.plus} busy={rep.busy} />
              <CashFlow ownerId={p.owner_id} plus={a.plus} onOpen={openExpense} onPlus={() => router.push("/plus")} />
              <Section title="Movimientos" testID="finances-list">
                {items.length === 0 ? <Txt v="caption">Nada con estos filtros.</Txt> : items.map((e) => (
                  <View key={e.id} style={[styles.item, { backgroundColor: colors.surfaceSecondary }]}>
                    <Row title={e.title} subtitle={[fmtDate(e.when), e.category, e.calc.pending_pay ? `Pendiente ${money(e.calc.pending_pay)}` : "Pagado", e.calc.direct ? "Pago directo" : ""].filter(Boolean).join(" · ")}
                      onPress={() => router.push({ pathname: "/expense-form", params: { id: e.id, owner_id: p.owner_id } })} testID={`finances-item-${e.id}`} last
                      right={<View style={{ alignItems: "flex-end", gap: 2 }}><Txt v="medium">{money(e.calc.total).replace(" MXN", "")}</Txt>{e.calc.claim_status ? <Badge label={e.calc.claim_status.length > 18 ? "Reembolso" : e.calc.claim_status} tint="butter" /> : null}</View>} />
                  </View>
                ))}
              </Section>
            </>
          )}
          <Txt v="caption" style={{ marginTop: space.lg }}>{q.data.note}</Txt>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: 24, padding: space.lg, marginTop: space.md },
  bento: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  tile: { width: "31%", flexGrow: 1, borderRadius: radius.lg, padding: space.md, minHeight: 84 },
  item: { borderRadius: radius.lg, paddingHorizontal: space.md, marginBottom: space.sm },
});
