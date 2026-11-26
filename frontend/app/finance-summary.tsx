import { useLocalSearchParams } from "expo-router";

import { api, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { fmtDate, fmtDateTime } from "@/src/constants";
import { WeekSummary } from "@/src/finance/week-share";
import { Card, ErrorState, Loading, Screen, Txt } from "@/src/ui";
import { space } from "@/src/theme";

/** A weekly summary a patient chose to send. Read-only snapshot: it does not open their expenses or documents. */
export default function FinanceSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApi<any>(`/finance/shares/${id}`);
  const s = q.data;
  const { user } = useAuth();
  const toast = useToast();
  const mine = s && user?.id === s.caregiver_id;
  const take = async (kind: string, item_id: string, t: boolean) => {
    try {
      await api(`/finance/shares/${id}/take`, { method: "POST", body: { kind, item_id, take: t } });
      toast.show(t ? `Le avisamos a ${s.owner_name} que tú te encargas` : `Le avisamos a ${s.owner_name}`);
      q.refetch();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };
  return (
    <Screen title="Resumen de la semana" subtitle={s ? `${s.owner_name} · siete días desde ${fmtDate(s.start).toLowerCase()}` : undefined} testID="finance-summary-screen">
      {q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !s ? <Loading /> : (
        <>
          {s.note ? <Card tint="lavender" style={{ marginBottom: space.md }}><Txt testID="finance-summary-note">“{s.note}”</Txt></Card> : null}
          <WeekSummary s={s} amounts={s.include_amounts} onTake={mine ? take : undefined} />
          <Txt v="caption" style={{ marginTop: space.lg }}>Copia enviada el {fmtDateTime(s.created_at)}. No se actualiza sola y no da acceso a los gastos, coberturas ni documentos de {s.owner_name}.{mine ? " «Yo me encargo» solo le avisa; no registra ningún pago." : ""}</Txt>
        </>
      )}
    </Screen>
  );
}
