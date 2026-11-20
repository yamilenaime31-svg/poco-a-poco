import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ShareWith } from "@/src/components/share-with";
import { CATEGORIES, KIT_CONTEXTS, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Field, Ic, Loading, ProductImage, ProgressBar, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

type Item = { product_id: string; options: Record<string, string> };
const STEPS = ["Para quién", "Tamaño", "Momento", "Artículos", "Resumen"];
const CONTEXT_TAGS: Record<string, string[]> = {
  "Antes del tratamiento": ["preparación", "organización", "papeles", "Escribir"],
  "Durante el tratamiento": ["llevar", "entretenimiento", "Descansar", "Calidez"],
  "Después del tratamiento": ["casa", "descanso", "Descansar", "cuidado"],
  Hospital: ["llevar", "Descansar", "comodidad", "cuidado"],
  Consulta: ["papeles", "llevar", "organización"],
  Casa: ["casa", "descanso", "Luz tenue", "Calidez"],
};

export default function KitBuilder() {
  const params = useLocalSearchParams<{ id?: string; template?: string; context?: string; for_name?: string; for_user_id?: string; add?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const products = useApi<any[]>("/products");
  const sizes = useApi<any[]>("/kit-sizes");
  const source = useApi<any>(params.id || params.template ? `/kits/${params.id || params.template}` : null);
  const net = useApi<any>("/network");
  const [step, setStep] = useState(0);
  const [forWho, setForWho] = useState<"me" | "other">(params.for_name ? "other" : user?.role === "caregiver" ? "other" : "me");
  const [forName, setForName] = useState(params.for_name || "");
  const [forUserId, setForUserId] = useState(params.for_user_id || "");
  const [context, setContext] = useState(KIT_CONTEXTS.some((c) => c.label === params.context) ? params.context! : "");
  const [otherCtx, setOtherCtx] = useState("");
  const [size, setSize] = useState("Chico");
  const [items, setItems] = useState<Item[]>(params.add ? [{ product_id: params.add, options: {} }] : []);
  const [shared, setShared] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("sugeridos");
  const [quote, setQuote] = useState<any>(null);

  useEffect(() => {
    const k = source.data;
    if (!k) return;
    const known = KIT_CONTEXTS.some((c) => c.label === k.context);
    setContext(known ? k.context : k.context ? "Otro" : "");
    if (!known) setOtherCtx(k.context || "");
    setSize(k.size || "Chico");
    setItems(k.items.map((i: any) => ({ product_id: i.product_id, options: i.options || {} })));
    setName(k.template ? `${k.name} (mío)` : k.name);
    setNote(k.note || "");
    setShared(k.shared_with || []);
    if (k.for_name) { setForWho("other"); setForName(k.for_name); }
    setStep(params.id ? 4 : 3);
  }, [source.data, params.id]);

  const sz = (sizes.data || []).find((s) => s.id === size) || { max: 4, base: 299, label: "Kit chico" };
  const pmap: Record<string, any> = Object.fromEntries((products.data || []).map((p) => [p.id, p]));
  const supplements = items.reduce((a, i) => a + (pmap[i.product_id]?.tier === "premium" ? pmap[i.product_id].supplement : 0), 0);
  const total = sz.base + supplements;
  const ctxLabel = context === "Otro" ? otherCtx.trim() || "Otro" : context;
  const tags = CONTEXT_TAGS[context] || [];
  const catalog = (products.data || []).filter((p) => p.category !== "Detalles" && p.status !== "descontinuado");
  const visible = filter === "sugeridos" && tags.length
    ? [...catalog].sort((a, b) => Number(b.tags.some((t: string) => tags.includes(t))) - Number(a.tags.some((t: string) => tags.includes(t)))).slice(0, 12)
    : catalog.filter((p) => filter === "sugeridos" || p.category === filter);
  const linked = (net.data?.as_caregiver || []).filter((l: any) => l.status === "active");
  const unavailable = items.filter((i) => pmap[i.product_id] && !pmap[i.product_id].available);

  useEffect(() => {
    if (step !== 4) return;
    api("/kits/quote", { method: "POST", body: { size, items } }).then(setQuote).catch((e) => toast.show(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, size, items.length, supplements]);

  const toggleItem = (pid: string) => {
    if (items.some((i) => i.product_id === pid)) return setItems(items.filter((i) => i.product_id !== pid));
    if (!pmap[pid]?.available) return toast.show("Este artículo no está disponible por ahora", "error");
    if (items.length >= sz.max) return toast.show(`Tu ${sz.label.toLowerCase()} ya está completo. Quita un artículo para cambiarlo.`, "error");
    setItems([...items, { product_id: pid, options: {} }]);
  };
  const setOpt = (pid: string, k: string, v: string) => setItems(items.map((i) => (i.product_id === pid ? { ...i, options: { ...i.options, [k]: v } } : i)));
  const pickSize = (s: any) => {
    setSize(s.id);
    if (items.length > s.max) { setItems(items.slice(0, s.max)); toast.show(`Quitamos los últimos artículos para ajustarlo a ${s.max}`); }
  };
  const canNext = [forWho === "me" || !!forName.trim(), !!size, !!context && (context !== "Otro" || !!otherCtx.trim()), items.length > 0, true][step];

  const save = async (thenOrder: boolean) => {
    if (thenOrder && unavailable.length) return toast.show("Cambia los artículos no disponibles para continuar", "error");
    setSaving(true);
    const body = { name: name.trim() || `Kit · ${ctxLabel}`, context: ctxLabel, size, items, note, for_name: forWho === "other" ? forName.trim() : "", for_user_id: forWho === "other" ? forUserId || null : null, shared_with: shared };
    try {
      const k = params.id ? await api(`/kits/${params.id}`, { method: "PUT", body }) : await api("/kits", { method: "POST", body });
      if (thenOrder) await api("/cart", { method: "POST", body: { type: "kit", ref_id: k.id, qty: 1 } });
      invalidate();
      toast.show(thenOrder ? "Kit guardado y agregado a tu pedido" : "Kit guardado. Puedes pedirlo cuando quieras.");
      router.replace(thenOrder ? "/cart" : `/kit/${k.id}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const footer = step === 4 ? (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Btn label="Editar kit" variant="ghost" onPress={() => setStep(3)} testID="kit-edit-items" style={{ flex: 1 }} />
        <Btn label="Guardar kit" variant="secondary" loading={saving} onPress={() => save(false)} testID="kit-save-button" style={{ flex: 1 }} />
      </View>
      <Btn label="Continuar pedido" icon="arrow-right" loading={saving} disabled={!!unavailable.length} onPress={() => save(true)} testID="kit-order-button" />
    </View>
  ) : (
    <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
      {step > 0 ? <Btn label="Atrás" variant="ghost" onPress={() => setStep(step - 1)} testID="kit-back-button" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {step >= 1 ? (
          <>
            <Txt v="title" testID="kit-total">{money(total)}</Txt>
            <Txt v="caption" testID="kit-count">{items.length} de {sz.max} · {sz.max - items.length === 0 ? "completo" : `quedan ${sz.max - items.length}`}</Txt>
          </>
        ) : null}
      </View>
      <Btn label="Continuar" disabled={!canNext} onPress={() => setStep(step + 1)} testID="kit-next-button" style={{ minWidth: 130 }} />
    </View>
  );

  if (products.isLoading || sizes.isLoading || ((params.id || params.template) && source.isLoading))
    return <Screen title="Armar kit"><Loading /></Screen>;

  const tag = (p: any) => {
    if (!p.available) return { t: "NO DISPONIBLE", bg: colors.surfaceTertiary, fg: colors.muted };
    if (p.tier === "premium") return { t: `PREMIUM +${money(p.supplement)}`, bg: colors.lavenderSoft, fg: colors.onSurface };
    return { t: "INCLUIDO", bg: colors.sageSoft, fg: colors.onSurface };
  };

  return (
    <Screen title={params.id ? "Editar kit" : "Armar nuevo kit"} subtitle={`Paso ${step + 1} de 5 · ${STEPS[step]}`} testID={`kit-builder-step-${step}`} footer={footer}>
      <ProgressBar value={(step + 1) / 5} />
      <Animated.View key={step} entering={FadeIn.duration(220)} style={{ marginTop: space.lg }}>
        {step === 0 && (
          <>
            <Txt v="h1">¿Para quién es este kit?</Txt>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {[{ k: "me", t: "Para mí", d: "Según mis gustos y mi momento.", i: "user-round" }, { k: "other", t: "Para otra persona", d: "Un detalle para acompañar a alguien.", i: "gift" }].map((o) => (
                <Pressable key={o.k} onPress={() => setForWho(o.k as any)} testID={`kit-for-${o.k}`} style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: forWho === o.k ? colors.onSurface : colors.border }]}>
                  <Ic name={o.i} size={20} />
                  <View style={{ flex: 1 }}><Txt v="title">{o.t}</Txt><Txt v="caption">{o.d}</Txt></View>
                </Pressable>
              ))}
            </View>
            {forWho === "other" ? (
              <View style={{ marginTop: space.lg }}>
                {linked.length ? <ChipRow>{linked.map((l: any) => <Chip key={l.id} label={l.patient_name} selected={forUserId === l.patient_id} onPress={() => { setForUserId(l.patient_id); setForName(l.patient_name); }} testID={`kit-for-person-${l.patient_id}`} />)}</ChipRow> : null}
                <Field label="Nombre de la persona" value={forName} onChangeText={setForName} testID="kit-for-name-input" style={{ marginTop: space.md }} />
              </View>
            ) : null}
          </>
        )}
        {step === 1 && (
          <>
            <Txt v="h1">Elige un tamaño</Txt>
            <Txt v="caption" style={{ marginTop: space.xs }}>El precio base incluye tus artículos elegidos, empaque y armado. Solo los artículos premium suman un suplemento.</Txt>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {(sizes.data || []).map((s, i) => (
                <Pressable key={s.id} onPress={() => pickSize(s)} testID={`kit-size-${s.id}`} style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: size === s.id ? colors.onSurface : colors.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.sageSoft, width: 34 + i * 8, height: 34 + i * 8 }]}><Ic name="package" size={16 + i * 3} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt v="title">{s.label}</Txt>
                    <Txt v="caption">{s.text} incluidos</Txt>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Txt v="caption">Desde</Txt>
                    <Txt v="title">{money(s.base)}</Txt>
                  </View>
                </Pressable>
              ))}
            </View>
            <Txt v="caption" style={{ marginTop: space.md }}>Precios ilustrativos de este prototipo.</Txt>
          </>
        )}
        {step === 2 && (
          <>
            <Txt v="h1">¿Para qué momento?</Txt>
            <Txt v="caption" style={{ marginTop: space.xs }}>Lo usamos para mostrarte primero ideas útiles. Podrás elegir cualquier artículo.</Txt>
            <View style={{ marginTop: space.lg }}>
              <ChipRow>{KIT_CONTEXTS.map((c) => <Chip key={c.label} label={c.label} icon={c.icon} selected={context === c.label} onPress={() => setContext(c.label)} testID={`kit-context-${c.label}`} />)}</ChipRow>
            </View>
            {context === "Otro" ? <Field label="¿Para qué momento es?" value={otherCtx} onChangeText={setOtherCtx} placeholder="Ej. Viaje a otra ciudad" testID="kit-context-other-input" style={{ marginTop: space.md }} /> : null}
          </>
        )}
        {step === 3 && (
          <>
            <Txt v="h2">Elige tus artículos</Txt>
            <Txt v="caption">Combina categorías como quieras. Los artículos incluidos no cambian el precio.</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md }}>
              <Chip label={tags.length ? "Sugeridos" : "Todo"} selected={filter === "sugeridos"} onPress={() => setFilter("sugeridos")} testID="kit-filter-all" />
              {CATEGORIES.filter((c) => c.label !== "Detalles").map((c) => <Chip key={c.label} label={c.label === "Antojos y preferencias" ? "Antojos" : c.label} selected={filter === c.label} onPress={() => setFilter(c.label)} testID={`kit-filter-${c.label}`} />)}
            </ScrollView>
            {visible.map((p) => {
              const on = items.some((i) => i.product_id === p.id);
              const tg = tag(p);
              return (
                <Pressable key={p.id} onPress={() => toggleItem(p.id)} disabled={!p.available && !on} testID={`kit-product-${p.id}`} accessibilityState={{ selected: on, disabled: !p.available }}
                  style={[styles.prod, { backgroundColor: colors.surfaceSecondary, borderColor: on ? colors.onSurface : colors.border, opacity: p.available || on ? 1 : 0.6 }]}>
                  <ProductImage product={p} height={64} style={{ width: 64, borderRadius: radius.sm }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt v="medium" style={{ fontSize: 14, lineHeight: 19 }} numberOfLines={2}>{p.name}</Txt>
                    <Txt v="caption" numberOfLines={1}>{p.description}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      <View style={[styles.tag, { backgroundColor: tg.bg }]}><Txt v="label" style={{ fontSize: 10 }} color={tg.fg} testID={`kit-tag-${p.id}`}>{tg.t}</Txt></View>
                      <Txt v="caption" style={{ fontSize: 12 }}>{p.category === "Antojos y preferencias" ? "Antojos" : p.category}</Txt>
                    </View>
                  </View>
                  <View style={[styles.check, { borderColor: on ? colors.onSurface : colors.borderStrong, backgroundColor: on ? colors.surfaceInverse : "transparent" }]}>
                    <Ic name={on ? "check" : "plus"} size={16} color={on ? colors.onSurfaceInverse : colors.onSurface} />
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
        {step === 4 && (
          <>
            <Txt v="h1">Tu kit, a tu manera</Txt>
            <Txt v="caption" style={{ marginTop: space.xs }}>{[sz.label, ctxLabel, forWho === "other" ? `Para ${forName}` : "Para mí", `${items.length} artículos`].join(" · ")}</Txt>
            <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="kit-summary">
              <Row2 l={`${sz.label} (precio base)`} r={money(sz.base)} />
              {items.map((i) => {
                const p = pmap[i.product_id];
                if (!p) return null;
                return (
                  <View key={i.product_id} style={[styles.item, { borderTopColor: colors.divider }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt v="medium" style={{ fontSize: 14 }}>{p.name}</Txt>
                        <Txt v="caption">{[i.options.color, i.options.text ? `“${i.options.text}”` : null, !p.available ? "No disponible: cámbialo para pedir" : null].filter(Boolean).join(" · ") || p.category}</Txt>
                      </View>
                      <Txt v="caption" color={colors.onSurface} testID={`kit-line-${p.id}`}>{p.tier === "premium" ? `+${money(p.supplement)}` : "Incluido"}</Txt>
                      {p.colors?.length || p.personalize_text ? <Pressable onPress={() => setEditing(editing === p.id ? null : p.id)} hitSlop={8} testID={`kit-personalize-${p.id}`} style={styles.mini}><Ic name="sliders-horizontal" size={16} /></Pressable> : null}
                    </View>
                    {editing === p.id ? (
                      <View style={{ marginTop: space.sm }}>
                        {p.colors?.length ? <ChipRow>{p.colors.map((c: string) => <Chip key={c} label={c} selected={i.options.color === c} onPress={() => setOpt(p.id, "color", c)} testID={`kit-opt-${p.id}-${c}`} />)}</ChipRow> : null}
                        {p.personalize_text ? <Field value={i.options.text || ""} onChangeText={(v) => setOpt(p.id, "text", v)} placeholder="Iniciales o mensaje" maxLength={24} testID={`kit-opt-text-${p.id}`} style={{ marginTop: space.sm }} /> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              <View style={[styles.item, { borderTopColor: colors.divider, gap: 4 }]}>
                <Row2 l="Suplementos premium" r={supplements ? `+${money(supplements)}` : money(0)} />
                <Row2 l="Subtotal" r={money(total)} bold testID="kit-subtotal" />
                {quote?.breakdown?.discounts?.length ? quote.breakdown.discounts.map((d: any) => <Row2 key={d.label} l={d.label} r={`−${money(d.amount)}`} />) : <Row2 l="Descuento" r={money(0)} />}
                {quote?.breakdown?.credit ? <Row2 l="Crédito institucional" r={`−${money(quote.breakdown.credit)}`} /> : null}
                <Row2 l="Envío" r="Por calcular" />
                <Row2 l="Total de artículos" r={quote ? money(quote.breakdown.items_total) : "…"} bold testID="kit-items-total" />
              </View>
              <Txt v="caption" style={{ marginTop: space.sm }}>Aún no es el total final: el envío se calcula al continuar. {quote?.breakdown?.rule} Precios ilustrativos con IVA incluido.</Txt>
            </View>
            <Field label="Nombre del kit" value={name} onChangeText={setName} placeholder={`Kit · ${ctxLabel}`} testID="kit-name-input" />
            {user?.role !== "caregiver" ? <ShareWith value={shared} onChange={setShared} testID="kit-share" /> : null}
            <Field label="Nota o dedicatoria (opcional)" value={note} onChangeText={setNote} multiline testID="kit-note-input" />
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

function Row2({ l, r, bold, testID }: { l: string; r: string; bold?: boolean; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm, paddingVertical: 2 }}>
      <Txt v={bold ? "title" : "caption"} style={{ flex: 1 }}>{l}</Txt>
      <Txt v={bold ? "title" : "caption"} testID={testID}>{r}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1.5 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  prod: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, borderRadius: radius.md, borderWidth: 1.5, marginBottom: space.sm },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.lg, padding: space.lg, marginVertical: space.lg, borderWidth: StyleSheet.hairlineWidth },
  item: { paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.sm },
  mini: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
