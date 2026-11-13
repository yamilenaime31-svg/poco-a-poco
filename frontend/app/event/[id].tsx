import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { fmtLongDate, isDate } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, ErrorState, Ic, Loading, Row, Screen, Sheet, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function EventDetail() {
  const { id, owner_id } = useLocalSearchParams<{ id: string; owner_id?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const q = useApi<any>(`/records/events/${id}`);
  const [confirm, setConfirm] = useState(false);
  const e = q.data;
  const mine = e?.owner_id === user?.id;

  const remove = async () => {
    try {
      await api(`/records/events/${id}`, { method: "DELETE" });
      invalidate();
      setConfirm(false);
      toast.show("Evento eliminado");
      router.back();
    } catch (err: any) {
      toast.show(err.message, "error");
    }
  };

  return (
    <Screen
      title="Detalle del evento"
      testID="event-detail-screen"
      footer={
        e ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Btn label="Eliminar" variant="danger" icon="trash-2" onPress={() => setConfirm(true)} testID="event-delete-button" style={{ flex: 1 }} />
            <Btn label="Editar" icon="pencil" onPress={() => router.push({ pathname: "/record-form", params: { kind: "events", id, owner_id: owner_id || "" } })} testID="event-edit-button" style={{ flex: 1 }} />
          </View>
        ) : null
      }
      overlay={
        <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Eliminar este evento?" testID="event-delete-sheet">
          <Txt style={{ marginBottom: space.xl }}>Puedes volver a crearlo cuando quieras.</Txt>
          <Btn label="Sí, eliminar" variant="danger" onPress={remove} testID="event-delete-confirm-button" />
        </Sheet>
      }
    >
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <>
          {e.type ? <Badge label={e.type} tint="sage" testID="event-type-badge" /> : null}
          <Txt v="h1" style={{ marginTop: space.md }} testID="event-title">
            {e.title}
          </Txt>
          <Card style={{ marginTop: space.xl }}>
            <Row icon="calendar" title={e.date && isDate(e.date) ? fmtLongDate(e.date) : "Sin fecha"} subtitle={e.time || "Sin hora"} />
            <Row icon="map-pin" title={e.location || "Sin lugar"} last={!e.notes} />
            {e.notes ? <Row icon="notebook-pen" title="Notas" subtitle={e.notes} last /> : null}
          </Card>
          {!mine ? (
            <Txt v="caption" style={{ marginTop: space.md }}>
              Este evento pertenece a la agenda compartida de otra persona.
            </Txt>
          ) : null}
          <Txt v="label" style={{ marginTop: space.xxl, marginBottom: space.sm }}>
            Preparar
          </Txt>
          <Row icon="car" tint="lavender" title="Organizar traslado" subtitle="Crea un traslado para este día" onPress={() => router.push({ pathname: "/record-form", params: { kind: "transfers", date: e.date, title: `Traslado: ${e.title}`, destination: e.location || "", owner_id: owner_id || "" } })} testID="event-add-transfer" />
          {mine ? <Row icon="radio" tint="coral" title="Pedir compañía" subtitle="Envía una señal a tu red" onPress={() => router.push({ pathname: "/signals", params: { type: "compania", message: `Para: ${e.title} (${e.date || ""} ${e.time || ""})` } })} testID="event-request-company" /> : null}
          <Row icon="package" tint="sage" title="Preparar un kit" subtitle="Lo que te acompaña ese día" onPress={() => router.push({ pathname: "/kit-builder", params: { context: e.type === "Sesión de tratamiento" ? "Sesión de tratamiento" : "Traslados" } })} testID="event-prepare-kit" last />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.xl }}>
            <Ic name="repeat" size={14} />
            <Txt v="caption">¿Cambió la fecha? Edítalo; nada es irreversible.</Txt>
          </View>
        </>
      )}
    </Screen>
  );
}
