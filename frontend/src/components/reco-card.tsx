import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { api, invalidate, useApi } from "@/src/api";
import { DEMO_PRICE, money, today } from "@/src/constants";
import { useToast } from "@/src/toast";
import { PlusGate, PlusTag } from "@/src/components/plus-gate";
import { Btn, Chip, ChipRow, Ic, Loading, ProductImage, Sheet, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

const TYPE_LABEL: Record<string, string> = { gustos: "Tus gustos", registro: "Lo que registraste", proxima: "Tu próxima actividad", tratamiento: "Información general sobre el tratamiento" };

/** Compact recommendation: image, name, demo price, one short reason, actions. Full explanation opens in a sheet. */
export function RecoCard({ p, onFeedback }: { p: any; onFeedback: (id: string, action: string, msg: string) => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [why, setWhy] = useState(false);
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`reco-card-${p.id}`}>
      <Pressable onPress={() => router.push(`/product/${p.id}`)} style={styles.top} testID={`reco-view-${p.id}`}>
        <ProductImage product={p} height={76} style={{ width: 76, borderRadius: radius.sm }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="title" numberOfLines={2}>{p.name}</Txt>
          <Txt v="caption">{money(p.price)} · {DEMO_PRICE}</Txt>
        </View>
      </Pressable>
      <Txt v="caption" color={colors.onSurface} numberOfLines={2} style={{ marginTop: space.sm }} testID={`reco-reason-${p.id}`}>{p.reasons?.[0]}</Txt>
      <View style={styles.actions}>
        <Btn label="Agregar al kit" small icon="plus" onPress={() => router.push({ pathname: "/kit-builder", params: { add: p.id } })} testID={`reco-add-${p.id}`} style={{ flex: 1, paddingHorizontal: 8, minHeight: 40 }} />
        <Pressable onPress={() => setWhy(true)} hitSlop={6} testID={`reco-why-${p.id}`} accessibilityLabel="¿De dónde viene esta recomendación?" style={[styles.icon, { borderColor: colors.border }]}><Ic name="info" size={16} /></Pressable>
      </View>
      <View style={styles.links}>
        <Pressable onPress={() => onFeedback(p.id, "interested", "Anotado: te interesa")} style={styles.link} testID={`reco-interested-${p.id}`}><Txt v="caption" style={styles.u}>Me interesa</Txt></Pressable>
        <Pressable onPress={() => onFeedback(p.id, "dismiss", "No te lo mostraremos de nuevo")} style={styles.link} testID={`reco-dismiss-${p.id}`}><Txt v="caption" style={styles.u}>No me interesa</Txt></Pressable>
        <Pressable onPress={() => onFeedback(p.id, "owned", "Anotado: ya lo tienes")} style={styles.link} testID={`reco-owned-${p.id}`}><Txt v="caption" style={styles.u}>Ya lo tengo</Txt></Pressable>
      </View>
      {why ? <WhySheet p={p} onClose={() => setWhy(false)} /> : null}
    </View>
  );
}

function WhySheet({ p, onClose }: { p: any; onClose: () => void }) {
  const { colors } = useTheme();
  const q = useApi<any>(`/recommendations/explain/${p.id}?today=${today()}`);
  const details: any[] = q.data?.details || p.reason_details || [];
  return (
    <Sheet visible onClose={onClose} title="¿De dónde viene esta recomendación?" testID="reco-why-sheet">
      {q.isLoading ? <Loading /> : (
        <>
          <Txt style={{ marginBottom: space.md }} testID="reco-why-text">{q.data?.text || p.reasons?.[0]}</Txt>
          {details.map((d, i) => (
            <View key={i} style={[styles.detail, { backgroundColor: d.type === "tratamiento" ? colors.lavenderSoft : colors.surfaceTertiary }]}>
              <Txt v="label">{TYPE_LABEL[d.type] || "Motivo"}</Txt>
              <Txt v="caption" color={colors.onSurface}>{d.text}</Txt>
              {d.precaution ? <Txt v="caption" color={colors.onSurface} style={{ marginTop: 4 }}>Precaución: {d.precaution}</Txt> : null}
              {(d.sources || []).map((s: any) => (
                <Pressable key={s.url} onPress={() => Linking.openURL(s.url)} hitSlop={6} testID={`reco-source-${i}`}>
                  <Txt v="caption" style={styles.u}>Fuente: {s.name}</Txt>
                </Pressable>
              ))}
            </View>
          ))}
          {q.data?.plus ? <PlusTag why="Explicación ampliada, parte de tu membresía." testID="reco-why-plus" /> : null}
          {q.data && q.data.plus === false ? <Txt v="caption" style={{ marginTop: space.sm }} testID="reco-why-basic">Explicación básica. Con AMODO Plus verás una explicación ampliada.</Txt> : null}
          <Txt v="caption" style={{ marginTop: space.sm }}>Solo sugerimos artículos del catálogo. No afirmamos que prevengan o alivien síntomas. El precio es de ejemplo.</Txt>
        </>
      )}
    </Sheet>
  );
}

/** Asks, never assumes: offers to explore needs some people have during the treatments the person registered. */
export function NeedsPrompt() {
  const { colors } = useTheme();
  const toast = useToast();
  const q = useApi<any>("/recommendations/needs");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[] | null>(null);
  if (!q.data?.needs?.length) return null;
  if (!q.data.plus)
    return <PlusGate title="Ideas según tu tratamiento" text="Con Plus, las sugerencias pueden considerar tu tratamiento, tu próxima cita y las necesidades que elijas, con explicaciones ampliadas. Las sugerencias por tus gustos siguen disponibles." testID="reco-needs-plus-gate">{null}</PlusGate>;
  const names = (q.data.treatments as string[]).filter((x) => x !== "Otro").join(", ").toLowerCase() || "tu tratamiento";
  const chosen = sel ?? q.data.needs.filter((n: any) => n.selected).map((n: any) => n.id);
  const save = async (ids: string[]) => {
    await api("/recommendations/needs", { method: "PUT", body: { needs: ids } });
    invalidate();
    setOpen(false);
    toast.show(ids.length ? "Usaremos esto solo para sugerirte artículos" : "Entendido, no lo tomaremos en cuenta");
  };
  return (
    <View style={[styles.prompt, { backgroundColor: colors.lavenderSoft }]} testID="reco-needs-prompt">
      <PlusTag why="Sugerencias según tu tratamiento y los temas que elijas." testID="reco-needs-plus" style={{ marginTop: 0, marginBottom: space.sm }} />
      <Txt v="medium" style={{ fontSize: 14 }}>
        {q.data.asked ? `Ideas según tu tratamiento: ${chosen.length === 1 ? "1 tema elegido" : chosen.length ? `${chosen.length} temas elegidos` : "ninguno elegido"}` : `¿Te gustaría explorar artículos relacionados con molestias que algunas personas experimentan durante ${names}?`}
      </Txt>
      {open ? (
        <>
          <Txt v="caption" color={colors.onSurface} style={{ marginVertical: space.sm }}>Elige solo lo que sea relevante para ti. Es información general, no un diagnóstico.</Txt>
          <ChipRow>
            {q.data.needs.map((n: any) => <Chip key={n.id} label={n.label} selected={chosen.includes(n.id)} onPress={() => setSel(chosen.includes(n.id) ? chosen.filter((x: string) => x !== n.id) : [...chosen, n.id])} testID={`reco-need-${n.id}`} />)}
          </ChipRow>
          <View style={[styles.actions, { marginTop: space.md }]}>
            <Btn label="No, gracias" small variant="ghost" onPress={() => save([])} testID="reco-needs-none" style={{ flex: 1 }} />
            <Btn label="Guardar" small onPress={() => save(chosen)} testID="reco-needs-save" style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <Pressable onPress={() => setOpen(true)} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }} testID="reco-needs-open"><Txt v="caption" color={colors.onSurface} style={styles.u}>{q.data.asked ? "Cambiar" : "Ver opciones"}</Txt></Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 264, borderRadius: radius.lg, padding: space.md, borderWidth: 0 },
  top: { flexDirection: "row", gap: space.md, alignItems: "center" },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.sm, alignItems: "center" },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  links: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  link: { minHeight: 44, justifyContent: "center" },
  u: { textDecorationLine: "underline" },
  detail: { borderRadius: radius.sm, padding: space.md, marginBottom: space.sm, gap: 2 },
  prompt: { borderRadius: radius.md, padding: space.md, marginBottom: space.md },
});
