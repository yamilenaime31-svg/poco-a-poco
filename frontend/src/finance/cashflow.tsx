// Plus: what is still to pay and what may be recovered in the coming months. Always labelled as an estimate.
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useApi } from "@/src/api";
import { PlusTag } from "@/src/components/plus-gate";
import { MONTHS_LONG, fmtDate, money, today } from "@/src/constants";
import { Badge, Row, Section, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const short = (v: number) => money(v).replace(" MXN", "");

export function CashFlow({ ownerId, plus, onOpen, onPlus }: { ownerId?: string; plus?: boolean; onOpen: (id: string) => void; onPlus: () => void }) {
  const { colors } = useTheme();
  const q = useApi<any>(plus ? `/finance/cashflow?today=${today()}${ownerId ? `&owner_id=${ownerId}` : ""}` : null);
  const [open, setOpen] = useState<any>(null);

  if (!plus)
    return (
      <Section title="Próximos meses" testID="finances-cashflow-locked">
        <Row icon="calendar-range" tint="lavender" title="Flujo de efectivo estimado" subtitle="Con AMODO Plus ves por mes lo que falta pagar y lo que podrías recuperar." onPress={onPlus} testID="finances-cashflow-plus" right={<Badge label="Plus" tint="lavender" />} last />
      </Section>
    );
  if (!q.data?.has_any) return null;
  const d = q.data;
  const label = (k: string) => (k === "overdue" ? "Fecha ya pasada" : k === "later" ? "Más adelante" : k === "undated" ? "Sin fecha registrada" : `${MONTHS_LONG[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`);
  const rows: any[] = [d.overdue, ...d.months, d.later, d.undated].filter((b: any) => b.items.length);
  const top = Math.max(1, ...rows.map((b) => Math.max(b.pay, b.receive)));

  return (
    <Section title="Próximos meses · estimación" testID="finances-cashflow">
      <PlusTag why="Con tu membresía ves lo que viene por pagar y recuperar, mes a mes." testID="finances-cashflow-plus-tag" style={{ marginTop: 0, marginBottom: space.sm }} />
      {rows.map((b) => (
        <Pressable key={b.key} onPress={() => setOpen(b)} testID={`finances-cashflow-${b.key}`} accessibilityRole="button" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm }}>
          <Txt v="medium" style={{ textTransform: "capitalize", marginBottom: 6 }}>{label(b.key)}</Txt>
          {([["pay", "Por pagar", colors.coral], ["receive", "Por recuperar (estimado)", colors.sage]] as const).filter(([k]) => b[k] > 0).map(([k, l, tint]) => (
            <View key={k} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row" }}>
                <Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{l}</Txt>
                <Txt v="caption" color={colors.onSurface}>{short(b[k])}</Txt>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: 3 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: tint, width: `${Math.max(3, (b[k] / top) * 100)}%` }} />
              </View>
            </View>
          ))}
        </Pressable>
      ))}
      {d.in_review > 0 ? <Txt v="caption" testID="finances-cashflow-review">En revisión y sin autorizar: {money(d.in_review)}. No se suma a lo recuperable.</Txt> : null}
      <Txt v="caption" style={{ marginTop: 4 }}>{d.note}</Txt>
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? label(open.key).replace(/^./, (c) => c.toUpperCase()) : ""} testID="finances-cashflow-sheet">
        <Txt v="caption" style={{ marginBottom: space.sm }}>Usa la fecha límite de pago de cada gasto y la fecha estimada de resolución de cada reembolso. Puedes cambiarlas en el gasto.</Txt>
        {(open?.items || []).map((i: any, n: number, all: any[]) => (
          <Row key={`${i.id}-${i.kind}`} icon={i.kind === "pay" ? "banknote" : "undo-2"} tint={i.kind === "pay" ? "coral" : "sage"} title={i.title} last={n === all.length - 1}
            subtitle={[i.kind === "pay" ? "Por pagar" : "Por recuperar · estimado", money(i.amount), i.date ? fmtDate(i.date) : "sin fecha"].join(" · ")} onPress={() => { setOpen(null); onOpen(i.id); }} testID={`finances-cashflow-item-${i.id}-${i.kind}`} />
        ))}
      </Sheet>
    </Section>
  );
}
