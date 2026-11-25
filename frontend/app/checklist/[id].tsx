import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { ShareWith } from "@/src/components/share-with";
import { fmtDate } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, ErrorState, Field, Ic, IconBtn, Loading, ProgressBar, Screen, Section, Sheet, Txt, tap } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const q = useApi<any>(`/checklists/${id}`);
  const [c, setC] = useState<any>(null);
  const [text, setText] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [rename, setRename] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setC(q.data); }, [q.data]);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    try {
      const r = await fn();
      if (r?.items) setC(r);
      if (ok) toast.show(ok);
      return r;
    } catch (e: any) {
      toast.show(e.message, "error");
      q.refetch();
    }
  };
  const put = (body: any, ok?: string) => run(() => api(`/checklists/${id}`, { method: "PUT", body }), ok);
  const toggle = (it: any) => {
    tap();
    setC({ ...c, items: c.items.map((x: any) => (x.id === it.id ? { ...x, done: !it.done } : x)), done: c.done + (it.done ? -1 : 1) });
    run(() => api(`/checklists/${id}/toggle`, { method: "POST", body: { item_id: it.id, done: !it.done } }));
  };
  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await put({ items: [...c.items, { text: t }] });
  };
  const reuse = async () => {
    setBusy(true);
    const r = await run(() => api(`/checklists/${id}/reuse`, { method: "POST", body: {} }));
    setBusy(false);
    if (r?.id) {
      toast.show(c.mine ? "Copia lista para usar de nuevo" : "Guardamos una copia en tus listas");
      invalidate();
      router.replace(`/checklist/${r.id}`);
    }
  };
  const remove = async () => {
    await run(() => api(`/checklists/${id}`, { method: "DELETE" }));
    invalidate();
    router.back();
  };

  return (
    <Screen title={c?.title || "Lista"} subtitle={c ? [c.owner_name ? `Lista de ${c.owner_name}` : "", c.event ? `${c.event.title} · ${fmtDate(c.event.date)}${c.event.time ? ` ${c.event.time}` : ""}` : c.date ? fmtDate(c.date) : ""].filter(Boolean).join(" · ") : undefined}
      testID="checklist-screen" right={c?.mine ? <IconBtn icon="pencil" onPress={() => setRename(c.title)} testID="checklist-rename" /> : undefined}
      overlay={
        <>
          <Sheet visible={!!edit} onClose={() => setEdit(null)} title="Editar punto" testID="checklist-edit-sheet">
            <Field value={edit?.text || ""} onChangeText={(t) => setEdit({ ...edit, text: t })} maxLength={200} testID="checklist-edit-input" />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Btn label="Quitar" variant="secondary" icon="trash-2" style={{ flex: 1 }} testID="checklist-edit-remove" onPress={() => { put({ items: c.items.filter((x: any) => x.id !== edit.id) }); setEdit(null); }} />
              <Btn label="Guardar" style={{ flex: 1 }} disabled={!edit?.text?.trim()} testID="checklist-edit-save" onPress={() => { put({ items: c.items.map((x: any) => (x.id === edit.id ? { ...x, text: edit.text } : x)) }); setEdit(null); }} />
            </View>
          </Sheet>
          <Sheet visible={rename !== null} onClose={() => setRename(null)} title="Nombre de la lista" testID="checklist-rename-sheet">
            <Field value={rename || ""} onChangeText={setRename} maxLength={80} testID="checklist-rename-input" />
            <Btn label="Guardar" disabled={!rename?.trim()} onPress={() => { put({ title: rename }); setRename(null); }} testID="checklist-rename-save" />
          </Sheet>
          <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Eliminar esta lista?" testID="checklist-delete-sheet">
            <Txt v="caption" style={{ marginBottom: space.lg }}>Dejará de verse también para las personas con quienes la compartiste.</Txt>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirm(false)} testID="checklist-delete-cancel" />
              <Btn label="Eliminar" variant="danger" style={{ flex: 1 }} onPress={remove} testID="checklist-delete-confirm" />
            </View>
          </Sheet>
        </>
      }>
      {q.isError ? <ErrorState message={(q.error as any)?.message} onRetry={() => q.refetch()} /> : !c ? <Loading /> : (
        <>
          <Txt v="caption" testID="checklist-progress" style={{ marginBottom: 6 }}>{c.total ? `${c.done} de ${c.total} listos` : "Agrega lo que quieras tener listo"}</Txt>
          <ProgressBar value={c.total ? c.done / c.total : 0} />
          <View style={{ marginTop: space.md }}>
            {c.items.map((it: any) => (
              <View key={it.id} style={[styles.item, { borderBottomColor: colors.divider }]}>
                <Pressable onPress={() => toggle(it)} style={styles.press} testID={`checklist-item-${it.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: it.done }}>
                  <View style={[styles.box, { borderColor: it.done ? colors.surfaceInverse : colors.borderStrong, backgroundColor: it.done ? colors.surfaceInverse : "transparent" }]}>
                    {it.done ? <Ic name="check" size={14} color={colors.onSurfaceInverse} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt color={it.done ? colors.muted : colors.onSurface} style={it.done ? { textDecorationLine: "line-through" } : undefined}>{it.text}</Txt>
                    {it.done && it.done_by ? <Txt v="caption" style={{ fontSize: 12 }}>Listo · {it.done_by}</Txt> : null}
                  </View>
                </Pressable>
                {c.mine ? <IconBtn icon="ellipsis" onPress={() => setEdit(it)} testID={`checklist-item-edit-${it.id}`} /> : null}
              </View>
            ))}
          </View>
          {c.mine ? (
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Agregar un punto" maxLength={200} returnKeyType="done" onSubmitEditing={add} testID="checklist-add-input" style={{ marginBottom: 0 }} /></View>
              <Btn label="Agregar" variant="secondary" disabled={!text.trim()} onPress={add} testID="checklist-add-button" />
            </View>
          ) : null}
          <Txt v="caption" style={{ marginBottom: space.lg }}>{c.note}</Txt>
          {c.mine ? <ShareWith value={c.shared_with || []} onChange={(v) => put({ shared_with: v })} testID="checklist-share" /> : null}
          <Section title="Más" style={{ marginTop: 0 }}>
            <Btn label={c.mine ? "Usar de nuevo (copia sin marcar)" : "Guardar una copia para mí"} variant="secondary" icon="copy" loading={busy} onPress={reuse} testID="checklist-reuse" />
            {c.mine ? <Btn label="Eliminar lista" variant="ghost" icon="trash-2" onPress={() => setConfirm(true)} testID="checklist-delete" style={{ marginTop: space.sm }} /> : null}
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  press: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingVertical: space.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
