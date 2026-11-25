import { useLocalSearchParams } from "expo-router";

import { useApi } from "@/src/api";
import { fmtDate, fmtDateTime } from "@/src/constants";
import { WeekSummary } from "@/src/finance/week-share";
import { Card, ErrorState, Loading, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

/** A weekly summary a patient chose to send. Read-only snapshot: it does not open their expenses or documents. */
export default function FinanceSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<any>(`/finance/shares/${id}`);
  const s = q.data;
  return (
    <Screen title="Resumen de la semana" subtitle={s ? `${s.owner_name} · siete días desde ${fmtDate(s.start).toLowerCase()}` : undefined} testID="finance-summary-screen">
      {q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !s ? <Loading /> : (
        <>
          {s.note ? <Card tint="lavender" style={{ marginBottom: space.md }}><Txt testID="finance-summary-note">“{s.note}”</Txt></Card> : null}
          <WeekSummary s={s} amounts={s.include_amounts} />
          <Txt v="caption" style={{ marginTop: space.lg }}>Copia enviada el {fmtDateTime(s.created_at)}. No se actualiza sola y no da acceso a los gastos, coberturas ni documentos de {s.owner_name}.</Txt>
        </>
      )}
    </Screen>
  );
}
