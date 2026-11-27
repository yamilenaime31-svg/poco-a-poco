import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate } from "@/src/api";
import { ShareWith, joinNames, useCaregivers } from "@/src/components/share-with";
import { fmtLongDate, isDate } from "@/src/constants";
import { DateField, SingleChoice, TimeField } from "@/src/form";
import { organizeDraft } from "@/src/organize-store";
import { useToast } from "@/src/toast";
import { Badge, Btn, Card, Chip, ChipRow, Empty, Field, Ic, Screen, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

const CATS: Record<string, { label: string; icon: string; tint: string; dest: string }> = {
  event: { label: "Agenda", icon: "calendar", tint: "sage", dest: "Agenda" },
  transfer: { label: "Traslado", icon: "car", tint: "sky", dest: "Traslados" },
  task: { label: "Pendiente", icon: "list-checks", tint: "coral", dest: "Pendientes" },
  expense: { label: "Gasto", icon: "wallet", tint: "butter", dest: "Gastos" },
  medication: { label: "Medicamento", icon: "pill", tint: "lavender", dest: "Medicamentos" },
  treatment: { label: "Tratamiento", icon: "layers", tint: "sage", dest: "Tratamientos" },
};
const LABEL_TO_CAT = Object.fromEntries(Object.entries(CATS).map(([k, v]) => [v.label, k]));

function missing(it: any) {
  const m: string[] = [];
  if (["event", "transfer"].includes(it.category) && !it.date) m.push("fecha");
  if (it.category === "transfer" && !it.time) m.push("hora");
  if (it.category === "expense" && !it.amount) m.push("monto");
  return m;
}

export default function OrganizeReview() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const people = useCaregivers();
  const [items, setItems] = useState<any[]>(organizeDraft.items);
  const [open, setOpen] = useState<number | null>(null);
  const [shared, setShared] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (i: number, k: string, v: any) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const chosen = items.filter((i) => i.include);

  const commit = async () => {
    setBusy(true);
    try {
      const r = await api("/organize/commit", { method: "POST", body: { items: chosen, shared_with: shared } });
      invalidate();
      organizeDraft.text = "";
      organizeDraft.items = [];
      const names = people.filter((p) => shared.includes(p.caregiver_id)).map((p) => p.caregiver_name);
      toast.show(`Agregamos ${r.total} elemento(s)${names.length ? ` y lo compartiste con ${joinNames(names)}` : ""}`);
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Revisa antes de guardar"
      testID="organize-review-screen"
      footer={
        items.length ? (
          <>
            <Btn label={`Confirmar y guardar (${chosen.length})`} icon="check" loading={busy} disabled={!chosen.length} onPress={commit} testID="review-confirm-button" />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Btn label="Volver a escribir" small variant="ghost" onPress={() => router.back()} testID="review-rewrite-button" style={{ flex: 1 }} />
              <Btn label="Descartar" small variant="danger" onPress={() => { organizeDraft.items = []; organizeDraft.text = ""; toast.show("Descartado. No se guardó nada."); router.back(); }} testID="review-discard-button" style={{ flex: 1 }} />
            </View>
          </>
        ) : null
      }
    >
      {!items.length ? <Empty icon="sparkles" title="Nada por revisar" text="Vuelve a Organiza y cuéntame qué hay de nuevo." testID="review-empty" /> : (
        <>
          <Txt v="h2">Encontré estas actividades:</Txt>
          <Txt v="caption" style={{ marginTop: 4, marginBottom: space.lg }}>Nada se guarda hasta que confirmes. Desmarca lo que no quieras y edita lo necesario.</Txt>
          {items.map((it, i) => {
            const c = CATS[it.category];
            const miss = missing(it);
            const rel = it.related_to != null ? items[it.related_to] : null;
            return (
              <Card key={i} style={{ marginBottom: space.md, opacity: it.include ? 1 : 0.55 }} testID={`review-item-${i}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <Pressable onPress={() => set(i, "include", !it.include)} hitSlop={8} testID={`review-include-${i}`} style={{ width: 28, height: 28, borderRadius: 10, borderWidth: 1.5, borderColor: it.include ? colors.onSurface : colors.borderStrong, backgroundColor: it.include ? colors.surfaceInverse : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {it.include ? <Ic name="check" size={14} color={colors.onSurfaceInverse} /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                      <Badge label={c.label} tint={c.tint} />
                      <Badge label={miss.length ? `Revisa: falta ${miss.join(" y ")}` : "Listo"} tint={miss.length ? "coral" : "sage"} testID={`review-status-${i}`} />
                    </View>
                    <Txt v="title">{it.title}</Txt>
                    <Txt v="caption">
                      {[it.date && isDate(it.date) ? fmtLongDate(it.date) : null, it.time, it.responsible ? `Responsable: ${it.responsible}` : null, it.amount ? `$${it.amount}` : null, it.location].filter(Boolean).join(" · ") || "Sin fecha"}
                    </Txt>
                    {rel ? <Txt v="caption">Vinculado con: {rel.title}</Txt> : null}
                    {it.existing ? (
                      <View style={{ marginTop: 6 }} testID={`review-existing-${i}`}>
                        <Txt v="caption" color={colors.onSurface}>Ya tienes registrado: «{it.existing.title}»{it.existing.time ? ` · ${it.existing.time}` : ""}</Txt>
                        <ChipRow>
                          {([["keep", "Conservar el que tengo"], ["update", "Actualizarlo"], ["new", "Guardar como nuevo"]] as const).map(([k, l]) => (
                            <Chip key={k} label={l} selected={(it.on_existing || "keep") === k} onPress={() => set(i, "on_existing", k)} testID={`review-existing-${i}-${k}`} />
                          ))}
                        </ChipRow>
                      </View>
                    ) : null}
                  </View>
                  <Btn label={open === i ? "Listo" : "Editar"} small variant="ghost" onPress={() => setOpen(open === i ? null : i)} testID={`review-edit-${i}`} />
                </View>
                {it.questions?.length && it.include ? it.questions.map((q: string) => (
                  <View key={q} style={{ flexDirection: "row", gap: 6, marginTop: space.sm }}><Ic name="circle-help" size={14} /><Txt v="caption" color={colors.onSurface}>{q}</Txt></View>
                )) : null}
                {open === i ? (
                  <View style={{ marginTop: space.lg }}>
                    <SingleChoice label="Categoría" options={Object.values(CATS).map((x) => x.label)} value={c.label} onChange={(v) => v && set(i, "category", LABEL_TO_CAT[v])} testID={`review-cat-${i}`} />
                    <Field label="Título" value={it.title} onChangeText={(v) => set(i, "title", v)} testID={`review-title-${i}`} />
                    <DateField label="Fecha" value={it.date} onChange={(v) => set(i, "date", v)} testID={`review-date-${i}`} />
                    <TimeField label="Hora" value={it.time || ""} onChange={(v) => set(i, "time", v)} testID={`review-time-${i}`} />
                    <Field label="Responsable" value={it.responsible} onChangeText={(v) => set(i, "responsible", v)} testID={`review-responsible-${i}`} />
                    {it.category === "expense" ? <Field label="Monto (MXN)" value={it.amount ? String(it.amount) : ""} onChangeText={(v) => set(i, "amount", v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" testID={`review-amount-${i}`} /> : null}
                    <Field label="Información adicional" value={it.notes} onChangeText={(v) => set(i, "notes", v)} multiline testID={`review-notes-${i}`} />
                  </View>
                ) : null}
                {it.include ? <Txt v="caption" style={{ marginTop: space.sm }}>Se guardará en: {c.dest}</Txt> : null}
              </Card>
            );
          })}
          <Txt v="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>¿Quién puede verlo?</Txt>
          <ShareWith value={shared} onChange={setShared} testID="review-share" />
        </>
      )}
    </Screen>
  );
}
