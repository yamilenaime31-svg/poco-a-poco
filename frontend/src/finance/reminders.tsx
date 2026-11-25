// Reminders with date and time for the paperwork of one expense. They are saved as agenda tasks linked to the expense.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { fmtDate, today } from "@/src/constants";
import { DateField, TimeField, fmtTime, use24h } from "@/src/pickers";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Field, IconBtn, Row, Sheet, Txt } from "@/src/ui";
import { space } from "@/src/theme";

const TYPES = ["Entregar documentos", "Dar seguimiento al reembolso", "Fecha límite del trámite", "Revisar depósito", "Hacer un pago", "Otro"];

export function Reminders({ expenseId, expenseTitle, ownerId, canAdd, defaultDate }: { expenseId: string; expenseTitle: string; ownerId?: string; canAdd?: boolean; defaultDate?: string }) {
  const router = useRouter();
  const toast = useToast();
  const h24 = use24h();
  const q = useApi<any[]>(`/records/tasks${ownerId ? `?owner_id=${ownerId}` : ""}`);
  const [d, setD] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const list = (q.data || []).filter((t) => t.expense_id === expenseId);

  const save = async () => {
    const what = d.type === "Otro" ? d.custom.trim() : d.type;
    if (!what) return toast.show("Escribe qué quieres recordar", "error");
    if (!d.date) return toast.show("Elige la fecha", "error");
    setSaving(true);
    try {
      await api("/records/tasks", { method: "POST", body: { title: `${what}: ${expenseTitle}`, date: d.date, time: d.time, expense_id: expenseId, owner_id: ownerId || undefined } });
      invalidate();
      toast.show(d.time ? "Recordatorio programado. Aparece en tu agenda y te avisamos a esa hora" : "Recordatorio programado en tu agenda");
      setD(null);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const done = async (t: any) => {
    await api(`/records/tasks/${t.id}`, { method: "PUT", body: { done: !t.done } }).catch((e) => toast.show(e.message, "error"));
    invalidate();
  };

  return (
    <View testID="expense-reminders">
      {list.map((t) => (
        <Row key={t.id} icon="bell" tint={t.done ? "sand" : "butter"} title={t.title} subtitle={[t.date ? fmtDate(t.date) : "", t.time ? fmtTime(t.time, h24) : "sin hora", t.done ? "Hecho" : ""].filter(Boolean).join(" · ")} last
          onPress={() => router.push({ pathname: "/record-form", params: { kind: "tasks", id: t.id } })} testID={`reminder-item-${t.id}`}
          right={<IconBtn icon={t.done ? "rotate-ccw" : "check"} onPress={() => done(t)} testID={`reminder-done-${t.id}`} />} />
      ))}
      {list.length === 0 ? <Txt v="caption" style={{ marginBottom: space.sm }}>Sin recordatorios para este gasto. Puedes programar la entrega de documentos o el seguimiento de un reembolso.</Txt> : null}
      {canAdd ? <Btn label="Programar recordatorio" small variant="secondary" icon="bell-plus" onPress={() => setD({ type: TYPES[0], custom: "", date: defaultDate && defaultDate >= today() ? defaultDate : today(), time: "09:00" })} testID="reminder-add" style={{ alignSelf: "flex-start" }} /> : null}
      <Sheet visible={!!d} onClose={() => setD(null)} title="Programar recordatorio" testID="reminder-sheet">
        <ChipRow>{TYPES.map((x) => <Chip key={x} label={x} selected={d?.type === x} onPress={() => setD({ ...d, type: x })} testID={`reminder-type-${x}`} />)}</ChipRow>
        <View style={{ height: space.md }} />
        {d?.type === "Otro" ? <Field label="¿Qué quieres recordar?" value={d.custom} onChangeText={(v) => setD({ ...d, custom: v })} testID="reminder-custom" /> : null}
        <DateField label="Fecha" value={d?.date || ""} onChange={(v) => setD({ ...d, date: v })} testID="reminder-date" clearable={false} />
        <TimeField label="Hora" value={d?.time || ""} onChange={(v) => setD({ ...d, time: v })} testID="reminder-time" />
        <Txt v="caption" style={{ marginBottom: space.md }}>Se guarda como pendiente en tu agenda. Los avisos en el teléfono respetan tus horas de silencio y lo que elegiste en Notificaciones.</Txt>
        <Btn label="Programar" loading={saving} onPress={save} testID="reminder-save" />
      </Sheet>
    </View>
  );
}
