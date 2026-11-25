import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { useApi } from "@/src/api";
import { HBars } from "@/src/components/bars";
import { MONTHS_LONG, isDate, money } from "@/src/constants";
import { Card, Chip, ChipRow, Empty, ErrorState, Loading, Screen, Section, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const monthLabel = (m: string) => `${cap(MONTHS_LONG[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;
const sum = (rows: any[], f: (r: any) => boolean = () => true) => rows.filter(f).reduce((a, r) => a + r.amt, 0);
const group = (rows: any[], key: (r: any) => string) => {
  const m: Record<string, number> = {};
  rows.forEach((r) => { m[key(r)] = (m[key(r)] || 0) + r.amt; });
  return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

/** Análisis de gastos: month-to-month comparison and who paid, from the expenses the person registered. */
export default function ExpenseAnalysis() {
  const { owner_id } = useLocalSearchParams<{ owner_id?: string }>();
  const { colors } = useTheme();
  const q = useApi<any[]>(`/records/expenses${owner_id ? `?owner_id=${owner_id}` : ""}`);
  const [month, setMonth] = useState("");

  const rows = useMemo(() => (q.data || []).map((e) => ({
    amt: Number(e.amount) || 0,
    month: (isDate(e.date) ? e.date : e.created_at || "").slice(0, 7),
    payer: (e.paid_by || "").trim() || "Sin especificar",
    category: e.category || "Otro",
    paid: e.status === "Pagado",
  })).filter((r) => r.amt > 0 && r.month), [q.data]);
  const months = useMemo(() => [...new Set(rows.map((r) => r.month))].sort().slice(-6), [rows]);
  const top = Math.max(1, ...months.map((m) => sum(rows, (r) => r.month === m)));
  const sel = month && months.includes(month) ? month : "";
  const scope = sel ? rows.filter((r) => r.month === sel) : rows.filter((r) => months.includes(r.month));
  const total = sum(scope);
  const prev = sel ? months[months.indexOf(sel) - 1] : "";
  const diff = prev ? total - sum(rows, (r) => r.month === prev) : null;
  const payers = group(scope, (r) => r.payer);

  return (
    <Screen title="Análisis de gastos" subtitle="Por mes y por quién pagó" testID="expense-analysis-screen" refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !q.data ? <Loading /> : rows.length === 0 ? (
        <Empty icon="chart-no-axes-column" title="Aún no hay gastos para comparar" text="Cuando registres gastos con monto, aquí verás cómo se reparten por mes y por persona." testID="expense-analysis-empty" />
      ) : (
        <>
          <Card testID="expense-analysis-months">
            <Txt v="label">Mes a mes</Txt>
            <View style={styles.cols}>
              {months.map((m) => {
                const paid = sum(rows, (r) => r.month === m && r.paid);
                const pend = sum(rows, (r) => r.month === m && !r.paid);
                return (
                  <View key={m} style={styles.col}>
                    <Txt v="caption" style={styles.small} numberOfLines={1}>{money(paid + pend).replace(" MXN", "")}</Txt>
                    <View style={{ width: "62%", opacity: !sel || sel === m ? 1 : 0.45 }}>
                      {pend ? <View style={{ height: Math.max(2, (pend / top) * 96), backgroundColor: colors.sand, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} /> : null}
                      {paid ? <View style={{ height: Math.max(2, (paid / top) * 96), backgroundColor: colors.sage, borderTopLeftRadius: pend ? 0 : 3, borderTopRightRadius: pend ? 0 : 3 }} /> : null}
                    </View>
                    <Txt v="caption" style={styles.small}>{MONTHS_LONG[Number(m.slice(5, 7)) - 1].slice(0, 3)}</Txt>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={[styles.key, { backgroundColor: colors.sage }]} /><Txt v="caption" style={styles.small}>Pagado</Txt>
              <View style={[styles.key, { backgroundColor: colors.sand, marginLeft: space.md }]} /><Txt v="caption" style={styles.small}>Pendiente</Txt>
            </View>
          </Card>

          <View style={{ marginTop: space.lg }}>
            <ChipRow>
              <Chip label={months.length > 1 ? `Últimos ${months.length} meses` : "Todo"} selected={!sel} onPress={() => setMonth("")} testID="expense-analysis-month-all" />
              {[...months].reverse().map((m) => <Chip key={m} label={monthLabel(m)} selected={sel === m} onPress={() => setMonth(m)} testID={`expense-analysis-month-${m}`} />)}
            </ChipRow>
          </View>

          <Txt v="h2" style={{ marginTop: space.md }} testID="expense-analysis-total">{money(total)}</Txt>
          <Txt v="caption">Pagado: {money(sum(scope, (r) => r.paid))} · Pendiente: {money(sum(scope, (r) => !r.paid))}</Txt>
          {diff !== null ? (
            <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }} testID="expense-analysis-diff">
              {diff === 0 ? `Igual que en ${monthLabel(prev).toLowerCase()}` : `${money(Math.abs(diff))} ${diff > 0 ? "más" : "menos"} que en ${monthLabel(prev).toLowerCase()}`}
            </Txt>
          ) : null}

          <Section title="Quién pagó" testID="expense-analysis-payers">
            <HBars rows={payers} format={(v) => `${money(v)} · ${Math.round((v / (total || 1)) * 100)}%`} />
            {payers.some((p) => p.label === "Sin especificar") ? <Txt v="caption" style={{ marginTop: space.sm }}>Agrega “Pagado por” en cada gasto para ver el reparto completo.</Txt> : null}
          </Section>

          {!sel && months.length > 1 ? (
            <Section title="Quién pagó, mes a mes" testID="expense-analysis-payers-by-month">
              {[...months].reverse().map((m) => (
                <View key={m} style={{ marginBottom: space.md }}>
                  <Txt v="medium" style={{ fontSize: 14 }}>{monthLabel(m)}</Txt>
                  <Txt v="caption">{group(rows.filter((r) => r.month === m), (r) => r.payer).map((p) => `${p.label} ${money(p.value)}`).join(" · ")}</Txt>
                </View>
              ))}
            </Section>
          ) : null}

          <Section title="En qué se fue" testID="expense-analysis-categories">
            <HBars rows={group(scope, (r) => r.category)} format={money} />
          </Section>
          <Txt v="caption" style={{ marginTop: space.lg }}>Se calcula con los gastos que registraste. Los que no tienen fecha cuentan en el mes en que los anotaste.</Txt>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: space.md, minHeight: 130 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, minWidth: 0 },
  small: { fontSize: 11, lineHeight: 14 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.sm },
  key: { width: 10, height: 10, borderRadius: 2 },
});
