import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { api, useApi } from "@/src/api";
import { fmtDate } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Empty, ErrorState, Loading, ProgressBar, Row, Screen, Section, Sheet, Txt } from "@/src/ui";
import { space } from "@/src/theme";

function ListRow({ c, last }: { c: any; last: boolean }) {
  const router = useRouter();
  const sub = [c.owner_name ? `De ${c.owner_name}` : "", c.date ? fmtDate(c.date) : "", `${c.done} de ${c.total} listos`, c.mine && c.shared_with?.length ? "Compartida" : ""].filter(Boolean).join(" · ");
  return (
    <View>
      <Row icon={c.total && c.done === c.total ? "circle-check" : "list-checks"} tint="sand" title={c.title} subtitle={sub} onPress={() => router.push(`/checklist/${c.id}`)} testID={`checklist-row-${c.id}`} last />
      <View style={{ marginBottom: last ? 0 : space.sm }}><ProgressBar value={c.total ? c.done / c.total : 0} /></View>
    </View>
  );
}

/** Listas de preparación: editable, shareable with linked companions and reusable. Available on every plan. */
export default function Checklists() {
  const router = useRouter();
  const toast = useToast();
  const q = useApi<any>("/checklists");
  const tpl = useApi<any>("/checklists/templates");
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState("");

  const create = async (template: string) => {
    setBusy(template);
    try {
      const c = await api("/checklists", { method: "POST", body: { template } });
      setPick(false);
      router.push(`/checklist/${c.id}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen title="Listas de preparación" subtitle="Para citas, estudios y hospitalizaciones" testID="checklists-screen" refreshing={q.isRefetching} onRefresh={q.refetch}
      footer={<Btn label="Nueva lista" icon="plus" onPress={() => setPick(true)} testID="checklists-new" />}
      overlay={
        <Sheet visible={pick} onClose={() => setPick(false)} title="¿Para qué es la lista?" testID="checklists-template-sheet">
          {(tpl.data?.templates || []).map((t: any, i: number, all: any[]) => (
            <Row key={t.id} icon={t.icon} tint="sand" title={t.label} subtitle={t.items.length ? `${t.items.length} puntos sugeridos que puedes cambiar` : "Agrega tus propios puntos"}
              onPress={busy ? undefined : () => create(t.id)} testID={`checklists-template-${t.id}`} last={i === all.length - 1} />
          ))}
          <Txt v="caption" style={{ marginTop: space.md }}>{tpl.data?.note}</Txt>
        </Sheet>
      }>
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data ? <Loading /> : (
        <>
          {q.data.mine.length === 0 && q.data.shared.length === 0 ? (
            <Empty icon="list-checks" title="Aún no tienes listas" text="Parte de una lista sugerida para tu cita, estudio u hospitalización y ajústala a tu modo." action="Crear mi primera lista" onAction={() => setPick(true)} testID="checklists-empty" />
          ) : null}
          {q.data.mine.length ? (
            <Section title="Mis listas" style={{ marginTop: 0 }} testID="checklists-mine">
              {q.data.mine.map((c: any, i: number) => <ListRow key={c.id} c={c} last={i === q.data.mine.length - 1} />)}
            </Section>
          ) : null}
          {q.data.shared.length ? (
            <Section title="Compartidas conmigo" testID="checklists-shared">
              {q.data.shared.map((c: any, i: number) => <ListRow key={c.id} c={c} last={i === q.data.shared.length - 1} />)}
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
