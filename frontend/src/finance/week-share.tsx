// This week's pending payments and paperwork: the patient previews it and sends a snapshot to one companion.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDate, fmtDateTime, money, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Chip, ChipRow, Field, IconBtn, Row, Section, Sheet, SwitchRow, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** The summary itself. `amounts` false hides every figure. */
export function WeekSummary({ s, amounts = true }: { s: any; amounts?: boolean }) {
  const { colors } = useTheme();
  const amt = (v: any) => (amounts && v ? ` · ${money(v)}` : "");
  return (
    <View testID="week-summary">
      <Txt v="label" color={colors.onSurface}>Pagos pendientes</Txt>
      {s.payments.length === 0 ? <Txt v="caption" style={{ marginBottom: space.sm }}>Ninguno esta semana.</Txt> : s.payments.map((p: any, i: number) => (
        <Row key={i} icon="banknote" tint="coral" title={p.title} subtitle={`${fmtDate(p.date)}${amt(p.amount)}`} right={p.overdue ? <Badge label="Fecha pasada" tint="coral" /> : undefined} last />
      ))}
      <Txt v="label" color={colors.onSurface} style={{ marginTop: space.sm }}>Trámites de reembolso</Txt>
      {s.claims.length === 0 ? <Txt v="caption" style={{ marginBottom: space.sm }}>Ninguno requiere atención esta semana.</Txt> : s.claims.map((c: any, i: number) => (
        <Row key={i} icon="file-check" tint="butter" title={c.title} last
          subtitle={[c.status, c.date ? `resolución estimada ${fmtDate(c.date)}` : "", c.missing.length ? `falta: ${c.missing.join(", ")}` : ""].filter(Boolean).join(" · ") + amt(c.amount)} />
      ))}
      {s.reminders.length ? (
        <>
          <Txt v="label" color={colors.onSurface} style={{ marginTop: space.sm }}>Recordatorios</Txt>
          {s.reminders.map((r: any, i: number) => <Row key={i} icon="bell" tint="sky" title={r.title} subtitle={[fmtDate(r.date), r.time].filter(Boolean).join(" · ")} last />)}
        </>
      ) : null}
    </View>
  );
}

export function WeekShareSheet({ visible, onClose, people }: { visible: boolean; onClose: () => void; people: { caregiver_id: string; name: string }[] }) {
  const toast = useToast();
  const q = useApi<any>(visible ? `/finance/week-summary?today=${today()}` : null);
  const sent = useApi<any[]>(visible ? "/finance/shares" : null);
  const [to, setTo] = useState("");
  const [amounts, setAmounts] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const s = q.data;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api("/finance/shares", { method: "POST", body: { caregiver_id: to, today: today(), include_amounts: amounts, note } });
      toast.show(`Resumen enviado a ${r.caregiver_name}`);
      setNote("");
      sent.refetch();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    await api(`/finance/shares/${id}`, { method: "DELETE" }).catch((e) => toast.show(e.message, "error"));
    invalidate();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Resumen de la semana" testID="week-share-sheet">
      <Txt v="caption" style={{ marginBottom: space.md }}>Así se verá. La persona recibe solo esta copia de hoy: no puede abrir tus gastos, coberturas ni documentos, y puedes retirarla cuando quieras.</Txt>
      {!s ? <Txt v="caption">Cargando…</Txt> : s.empty ? <Txt testID="week-share-empty">No hay pagos ni trámites pendientes para los próximos siete días.</Txt> : (
        <>
          <WeekSummary s={s} amounts={amounts} />
          <SwitchRow label="Incluir importes" value={amounts} onValueChange={setAmounts} testID="week-share-amounts" />
          <Txt v="label" style={{ marginTop: space.sm, marginBottom: 6 }}>¿A quién se lo envías?</Txt>
          {people.length === 0 ? <Txt v="caption">Aún no tienes personas vinculadas.</Txt> : <ChipRow>{people.map((p) => <Chip key={p.caregiver_id} label={p.name} selected={to === p.caregiver_id} onPress={() => setTo(p.caregiver_id)} testID={`week-share-to-${p.caregiver_id}`} />)}</ChipRow>}
          <Field label="Mensaje (opcional)" value={note} onChangeText={setNote} testID="week-share-note" style={{ marginTop: space.md }} />
          <Btn label="Enviar resumen" icon="send" loading={busy} disabled={!to} onPress={send} testID="week-share-send" />
        </>
      )}
      {(sent.data || []).length ? (
        <View style={{ marginTop: space.lg }} testID="week-share-sent">
          <Txt v="label">Resúmenes que compartiste</Txt>
          {(sent.data || []).map((x) => (
            <View key={x.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 48 }}>
              <Txt style={{ flex: 1 }} numberOfLines={1}>{x.caregiver_name} · {fmtDateTime(x.created_at)}</Txt>
              <IconBtn icon="trash-2" onPress={() => revoke(x.id)} testID={`week-share-revoke-${x.id}`} />
            </View>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

/** Companion's Home: summaries a patient sent them. */
export function ReceivedSummaries({ ownerId }: { ownerId?: string }) {
  const router = useRouter();
  const q = useApi<any[]>(`/finance/shares?received=true${ownerId ? `&owner_id=${ownerId}` : ""}`);
  if (!(q.data || []).length) return null;
  return (
    <Section title="Resúmenes de pagos y trámites" testID="caregiver-finance-summaries">
      {(q.data || []).slice(0, 3).map((x, i, all) => (
        <Row key={x.id} icon="wallet" tint="butter" title={`Resumen enviado ${fmtDate(x.created_at.slice(0, 10)).toLowerCase()}`} subtitle={`${x.owner_name} · ${x.payments.length} pago(s) · ${x.claims.length} trámite(s)`} last={i === all.length - 1}
          onPress={() => router.push({ pathname: "/finance-summary", params: { id: x.id } })} testID={`caregiver-finance-summary-${x.id}`} />
      ))}
    </Section>
  );
}
