import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ShareWith, joinNames } from "@/src/components/share-with";
import { KINDS, TREATMENT_TYPES, isDate, isTime } from "@/src/constants";
import { DateField, SingleChoice, TimeField, TimesField } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Field, Loading, Screen, Sheet, SwitchRow, Txt } from "@/src/ui";
import { space } from "@/src/theme";

export default function RecordForm() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { kind, id, owner_id } = params;
  const def = KINDS[kind] || KINDS.events;
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const existing = useApi<any>(id ? `/records/${kind}/${id}` : null);
  const net = useApi<any>("/network");
  const [v, setV] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    def.fields.forEach((f) => params[f.key] && (init[f.key] = params[f.key]));
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [scopeBody, setScopeBody] = useState<Record<string, any> | null>(null);
  const fields = def.fields.filter((f) => !f.showIf || f.showIf(v));

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    // A custom treatment name is stored as the name itself; show it back under "Otro".
    if (kind === "treatments" && d.name && !TREATMENT_TYPES.includes(d.name)) {
      const type = TREATMENT_TYPES.includes(d.treatment_type) ? d.treatment_type : "Otro";
      setV({ ...d, name: type, custom_name: d.name, _custom: type !== "Otro" });
    }
    else setV(Array.isArray(d.times) ? { ...d, times: d.times.join(", ") } : d);
  }, [existing.data, kind]);

  const set = (k: string) => (val: any) => setV((p) => ({ ...p, [k]: val }));

  // People who can take a task: me + active links in either direction.
  const ownerId = existing.data?.owner_id || owner_id || user?.id;
  const isOwner = ownerId === user?.id;
  const people: { id: string; name: string }[] = user ? [{ id: user.id, name: "Yo" }] : [];
  (net.data?.as_patient || []).filter((l: any) => l.status === "active").forEach((l: any) => people.push({ id: l.caregiver_id, name: l.caregiver_name }));
  (net.data?.as_caregiver || []).filter((l: any) => l.status === "active" && l.patient_id === ownerId).forEach((l: any) => people.push({ id: l.patient_id, name: l.patient_name }));

  const save = async () => {
    const e: Record<string, string> = {};
    fields.forEach((f) => {
      const val = v[f.key];
      if (f.required && (val === undefined || val === "")) e[f.key] = "Este campo es necesario.";
      if (f.type === "date" && val && !isDate(val)) e[f.key] = "Usa el formato AAAA-MM-DD";
      if (f.type === "time" && val && !isTime(val)) e[f.key] = "Usa el formato HH:MM";
      if (f.type === "number" && val !== undefined && val !== "" && isNaN(Number(val))) e[f.key] = "Escribe un número.";
    });
    if (kind === "treatments" && v.name === "Otro" && !String(v.custom_name || "").trim()) e.custom_name = "Escribe el nombre del tratamiento.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: Record<string, any> = {};
    fields.forEach((f) => {
      if (v[f.key] === undefined) return;
      body[f.key] = f.key === "amount" ? Number(v[f.key]) : v[f.key];
    });
    if (kind === "treatments") {
      body.treatment_type = v.name;
      if (v.name === "Otro" || (v._custom && String(v.custom_name || "").trim())) body.name = String(v.custom_name || "").trim();
      delete body.custom_name;
    }
    if (kind === "medications" && typeof body.times === "string") {
      const bad = body.times.split(/[,;\s]+/).filter(Boolean).filter((x: string) => !isTime(x));
      if (bad.length) return setErrors({ times: "Usa horas como 08:00, 20:00" });
    }
    if (kind === "events" && id && v.series_id && !scopeBody) return setScopeBody(body);
    if (kind === "tasks") body.assignee_name = people.find((p) => p.id === v.assignee_id)?.name || "";
    if (isOwner) body.shared_with = v.shared_with || [];
    setSaving(true);
    try {
      if (id) await api(`/records/${kind}/${id}`, { method: "PUT", body });
      else await api(`/records/${kind}`, { method: "POST", body: { ...body, owner_id: owner_id || undefined } });
      invalidate();
      const sharedNames = people.filter((p) => (body.shared_with || []).includes(p.id)).map((p) => p.name);
      toast.show(sharedNames.length ? `Guardado y compartido con ${joinNames(sharedNames)}` : id ? "Cambios guardados" : "Guardado. Solo tú puedes verlo");
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/agenda");
    } catch (err: any) {
      toast.show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveSeries = async (scope: string) => {
    const body = scopeBody!;
    setScopeBody(null);
    setSaving(true);
    try {
      const r = await api(`/series/${v.series_id}`, { method: "PUT", body: { event_id: id, scope, changes: body } });
      invalidate();
      toast.show(r.updated > 1 ? `Actualizamos ${r.updated} fechas de la serie` : "Cambios guardados");
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/agenda");
    } catch (err: any) {
      toast.show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/records/${kind}/${id}`, { method: "DELETE" });
      invalidate();
      setConfirm(false);
      toast.show("Eliminado");
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/agenda");
    } catch (err: any) {
      toast.show(err.message, "error");
    }
  };

  return (
    <Screen
      title={`${id ? "Editar" : "Nuevo"} ${def.singular}`}
      testID={`record-form-${kind}`}
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {id ? <Btn label="Eliminar" variant="danger" icon="trash-2" onPress={() => setConfirm(true)} testID="record-delete-button" style={{ flex: 1 }} /> : null}
          <Btn label="Guardar" loading={saving} onPress={save} testID="record-save-button" style={{ flex: 1 }} />
        </View>
      }
      overlay={
        <>
        <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Eliminar?" testID="record-delete-sheet">
          <Txt style={{ marginBottom: space.xl }}>Esta acción no se puede deshacer, pero siempre puedes volver a agregarlo.</Txt>
          <Btn label="Sí, eliminar" variant="danger" onPress={remove} testID="record-delete-confirm-button" />
        </Sheet>
        <Sheet visible={!!scopeBody} onClose={() => setScopeBody(null)} title="¿Qué fechas quieres cambiar?" testID="series-scope-sheet">
          <Txt style={{ marginBottom: space.lg }}>Este evento es parte de una serie. Guardamos el historial de cambios.</Txt>
          <View style={{ gap: space.sm }}>
            <Btn label="Solo esta" onPress={() => saveSeries("one")} testID="series-scope-one" />
            <Btn label="Esta y las siguientes" variant="secondary" onPress={() => saveSeries("following")} testID="series-scope-following" />
            <Btn label="Toda la serie" variant="secondary" onPress={() => saveSeries("all")} testID="series-scope-all" />
          </View>
        </Sheet>
        </>
      }
    >
      {id && existing.isLoading ? <Loading /> : (
        <>
          {def.note ? (
            <Txt v="caption" style={{ marginBottom: space.lg }}>
              {def.note}
            </Txt>
          ) : null}
          {fields.map((f) => {
            const tid = `field-${f.key}`;
            if (f.type === "date") return <DateField key={f.key} label={f.label} value={v[f.key] || ""} onChange={set(f.key)} testID={tid} error={errors[f.key]} />;
            if (f.type === "time") return <TimeField key={f.key} label={f.label} value={v[f.key] || ""} onChange={set(f.key)} testID={tid} error={errors[f.key]} />;
            if (f.type === "times") return <TimesField key={f.key} label={f.label} value={v[f.key] || ""} onChange={set(f.key)} testID={tid} error={errors[f.key]} />;
            if (f.type === "select") return <SingleChoice key={f.key} label={f.label} options={f.options!} value={v[f.key]} onChange={set(f.key)} testID={tid} />;
            if (f.type === "switch") return <SwitchRow key={f.key} label={f.label} value={!!v[f.key]} onValueChange={set(f.key)} testID={tid} />;
            if (f.type === "assignee")
              return (
                <View key={f.key} style={{ marginBottom: space.xl }}>
                  <Txt v="medium" style={{ marginBottom: space.sm, fontSize: 14 }}>
                    {f.label}
                  </Txt>
                  <ChipRow>
                    {people.map((p) => (
                      <Chip key={p.id} label={p.name} selected={v.assignee_id === p.id} onPress={() => set("assignee_id")(v.assignee_id === p.id ? "" : p.id)} testID={`${tid}-${p.name}`} />
                    ))}
                  </ChipRow>
                </View>
              );
            return (
              <Field
                key={f.key}
                label={f.label}
                value={v[f.key] !== undefined ? String(v[f.key]) : ""}
                onChangeText={set(f.key)}
                placeholder={f.placeholder}
                multiline={f.type === "multiline"}
                keyboardType={f.type === "number" ? "decimal-pad" : "default"}
                error={errors[f.key]}
                testID={tid}
              />
            );
          })}
          {isOwner ? <ShareWith value={v.shared_with || []} onChange={set("shared_with")} testID="record-share" /> : <Txt v="caption">Esto pertenece al espacio de otra persona; ella decide con quién se comparte.</Txt>}
        </>
      )}
    </Screen>
  );
}
