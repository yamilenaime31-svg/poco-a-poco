// Expenses that share a claim number ("siniestro"), shown together with their own summary.
import { useState } from "react";
import { Pressable, View } from "react-native";

import { PlusTag } from "@/src/components/plus-gate";
import { fmtDate, money } from "@/src/constants";
import { Badge, Btn, Row, Section, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const KEYS: [string, string][] = [["total", "Costo registrado"], ["paid_own", "Pagado por ti o tu red"], ["direct", "Pago directo de terceros"], ["pending_pay", "Pendiente de pago"],
  ["requested", "Reembolso solicitado"], ["authorized", "Reembolso autorizado"], ["received", "Reembolso recibido"], ["pending_receive", "Por recibir (estimado)"]];

export const claimNo = (e: any) => String(e.claim?.claim_no || "").trim();

export function ClaimGroups({ items, selected, onFilter, onOpen, onReport, canReport, plus, busy }: {
  items: any[]; selected: string; onFilter: (no: string) => void; onOpen: (id: string) => void; onReport: (no: string) => void; canReport?: boolean; plus?: boolean; busy?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState("");
  const groups: Record<string, any[]> = {};
  items.forEach((e) => claimNo(e) && (groups[claimNo(e)] = [...(groups[claimNo(e)] || []), e]));
  const nos = Object.keys(groups);
  if (!nos.length) return null;
  const sum = (no: string, k: string) => (groups[no] || []).reduce((n, e) => n + e.calc[k], 0);
  const list = groups[open] || [];

  return (
    <Section title="Por siniestro" testID="finances-claims">
      {nos.map((no) => (
        <Pressable key={no} onPress={() => setOpen(no)} testID={`finances-claim-${no}`} accessibilityRole="button"
          style={({ pressed }) => ({ backgroundColor: selected === no ? colors.butter : colors.butterSoft, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm, opacity: pressed ? 0.9 : 1 })}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Txt v="title" numberOfLines={1}>Siniestro {no}</Txt>
              <Txt v="caption" color={colors.onSurface}>{groups[no].length} gasto(s) · {money(sum(no, "total"))}</Txt>
            </View>
            <Badge label={sum(no, "pending_receive") ? `Por recibir ${money(sum(no, "pending_receive")).replace(" MXN", "")}` : `Recibido ${money(sum(no, "received")).replace(" MXN", "")}`} tint="butter" />
          </View>
        </Pressable>
      ))}
      <Sheet visible={!!open} onClose={() => setOpen("")} title={`Siniestro ${open}`} testID="finances-claim-sheet">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Suma de los gastos en los que escribiste este número de siniestro. AMODO no consulta a la aseguradora.</Txt>
        {KEYS.filter(([k]) => k === "total" || sum(open, k) > 0).map(([k, l]) => (
          <View key={k} style={{ flexDirection: "row", minHeight: 30, alignItems: "center" }} testID={`finances-claim-sum-${k}`}>
            <Txt style={{ flex: 1 }}>{l}</Txt>
            <Txt v="medium">{money(sum(open, k))}</Txt>
          </View>
        ))}
        <Txt v="label" color={colors.onSurface} style={{ marginTop: space.md }}>Gastos de este siniestro</Txt>
        {list.map((e, i) => <Row key={e.id} title={e.title} subtitle={[fmtDate(e.when), money(e.calc.total), e.calc.claim_status].filter(Boolean).join(" · ")} onPress={() => { setOpen(""); onOpen(e.id); }} testID={`finances-claim-item-${e.id}`} last={i === list.length - 1} />)}
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Btn label={selected === open ? "Quitar filtro de este siniestro" : "Ver solo este siniestro"} variant="secondary" icon="filter" onPress={() => { onFilter(selected === open ? "" : open); setOpen(""); }} testID="finances-claim-filter" />
          {canReport ? <Btn label={plus ? "Descargar resumen en PDF" : "Resumen en PDF · Plus"} icon="download" loading={busy} onPress={() => onReport(open)} testID="finances-claim-report" /> : null}
          {canReport && plus ? <PlusTag why="El resumen en PDF del siniestro es parte de tu membresía." testID="finances-claim-plus" style={{ marginTop: 0 }} /> : null}
        </View>
      </Sheet>
    </Section>
  );
}
