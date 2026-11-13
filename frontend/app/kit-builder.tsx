import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { api, invalidate, useApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ProductCard } from "@/src/components/product-card";
import { CATEGORIES, KIT_CONTEXTS, KIT_SIZES, money } from "@/src/constants";
import { useToast } from "@/src/toast";
import { Btn, Chip, ChipRow, Field, Ic, Loading, ProductImage, ProgressBar, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

type Item = { product_id: string; options: Record<string, string> };
const STEPS = ["Para quién", "Contexto", "Tamaño", "Categorías", "Artículos", "Vista previa"];

export default function KitBuilder() {
  const params = useLocalSearchParams<{ id?: string; template?: string; context?: string; for_name?: string; for_user_id?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const products = useApi<any[]>("/products");
  const source = useApi<any>(params.id || params.template ? `/kits/${params.id || params.template}` : null);
  const net = useApi<any>("/network");
  const [step, setStep] = useState(params.context ? 2 : 0);
  const [forWho, setForWho] = useState<"me" | "other">(params.for_name ? "other" : user?.role === "caregiver" ? "other" : "me");
  const [forName, setForName] = useState(params.for_name || "");
  const [forUserId, setForUserId] = useState(params.for_user_id || "");
  const [context, setContext] = useState(params.context || "");
  const [size, setSize] = useState("Mediano");
  const [cats, setCats] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState("");

  useEffect(() => {
    const k = source.data;
    if (!k) return;
    setContext(k.context || "");
    setSize(k.size || "Mediano");
    setCats(k.categories?.length ? k.categories : Array.from(new Set(k.items.map((i: any) => i.product?.category))) as string[]);
    setItems(k.items.map((i: any) => ({ product_id: i.product_id, options: i.options || {} })));
    setName(k.template ? `${k.name} (mío)` : k.name);
    setNote(k.note || "");
    if (k.for_name) {
      setForWho("other");
      setForName(k.for_name);
    }
    setStep(params.id ? 5 : 4);
  }, [source.data, params.id]);

  const max = KIT_SIZES.find((s) => s.label === size)!.max;
  const base = KIT_SIZES.find((s) => s.label === size)!.base;
  const pmap: Record<string, any> = Object.fromEntries((products.data || []).map((p) => [p.id, p]));
  const total = base + items.reduce((a, i) => a + (pmap[i.product_id]?.price || 0), 0);
  const visible = (products.data || []).filter((p) => (catFilter ? p.category === catFilter : !cats.length || cats.includes(p.category)));
  const linked = (net.data?.as_caregiver || []).filter((l: any) => l.status === "active");

  const toggleItem = (pid: string) => {
    if (items.some((i) => i.product_id === pid)) return setItems(items.filter((i) => i.product_id !== pid));
    if (items.length >= max) return toast.show(`El tamaño ${size} admite hasta ${max} artículos`, "error");
    setItems([...items, { product_id: pid, options: {} }]);
  };
  const setOpt = (pid: string, k: string, v: string) => setItems(items.map((i) => (i.product_id === pid ? { ...i, options: { ...i.options, [k]: v } } : i)));

  const canNext = [forWho === "me" || !!forName.trim(), !!context, !!size, true, items.length > 0, true][step];

  const save = async () => {
    setSaving(true);
    const body = { name: name.trim() || `Kit · ${context}`, context, size, categories: cats, items, note, for_name: forWho === "other" ? forName.trim() : "", for_user_id: forWho === "other" ? forUserId || null : null };
    try {
      const k = params.id ? await api(`/kits/${params.id}`, { method: "PUT", body }) : await api("/kits", { method: "POST", body });
      invalidate();
      toast.show("Kit guardado");
      router.replace(`/kit/${k.id}`);
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
      {step > 0 ? <Btn label="Atrás" variant="ghost" onPress={() => setStep(step - 1)} testID="kit-back-button" /> : null}
      {step === 4 ? (
        <Txt v="caption" style={{ flex: 1 }} testID="kit-count">
          {items.length}/{max} · {money(total)}
        </Txt>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {step < 5 ? <Btn label="Continuar" disabled={!canNext} onPress={() => setStep(step + 1)} testID="kit-next-button" style={{ minWidth: 150 }} /> : <Btn label="Guardar kit" icon="check" loading={saving} onPress={save} testID="kit-save-button" style={{ minWidth: 150 }} />}
    </View>
  );

  if (products.isLoading || ((params.id || params.template) && source.isLoading))
    return (
      <Screen title="Armar kit">
        <Loading />
      </Screen>
    );

  return (
    <Screen title={params.id ? "Editar kit" : "Armar nuevo kit"} subtitle={`Paso ${step + 1} de 6 · ${STEPS[step]}`} testID={`kit-builder-step-${step}`} footer={footer}>
      <ProgressBar value={(step + 1) / 6} />
      <Animated.View key={step} entering={FadeIn.duration(250)} style={{ marginTop: space.xl }}>
        {step === 0 && (
          <>
            <Txt v="h1">¿Para quién es este kit?</Txt>
            <View style={{ gap: space.md, marginTop: space.xl }}>
              {[
                { k: "me", t: "Para mí", d: "Según mis gustos y mi momento.", i: "user-round" },
                { k: "other", t: "Para otra persona", d: "Un detalle para acompañar a alguien.", i: "gift" },
              ].map((o) => (
                <Pressable key={o.k} onPress={() => setForWho(o.k as any)} testID={`kit-for-${o.k}`} style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: forWho === o.k ? colors.onSurface : colors.border }]}>
                  <Ic name={o.i} size={22} />
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{o.t}</Txt>
                    <Txt v="caption">{o.d}</Txt>
                  </View>
                </Pressable>
              ))}
            </View>
            {forWho === "other" ? (
              <View style={{ marginTop: space.xl }}>
                {linked.length ? (
                  <ChipRow>
                    {linked.map((l: any) => (
                      <Chip key={l.id} label={l.patient_name} selected={forUserId === l.patient_id} onPress={() => { setForUserId(l.patient_id); setForName(l.patient_name); }} testID={`kit-for-person-${l.patient_id}`} />
                    ))}
                  </ChipRow>
                ) : null}
                <Field label="Nombre de la persona" value={forName} onChangeText={setForName} testID="kit-for-name-input" style={{ marginTop: space.md }} />
              </View>
            ) : null}
          </>
        )}
        {step === 1 && (
          <>
            <Txt v="h1">¿Para qué momento?</Txt>
            <View style={{ gap: space.md, marginTop: space.xl }}>
              {KIT_CONTEXTS.map((c) => (
                <Pressable key={c.label} onPress={() => setContext(c.label)} testID={`kit-context-${c.label}`} style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: context === c.label ? colors.onSurface : colors.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.sageSoft }]}>
                    <Ic name={c.icon} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{c.label}</Txt>
                    <Txt v="caption">{c.text}</Txt>
                  </View>
                  {context === c.label ? <Ic name="circle-check" size={20} /> : null}
                </Pressable>
              ))}
            </View>
          </>
        )}
        {step === 2 && (
          <>
            <Txt v="h1">Elige un tamaño</Txt>
            <Txt v="caption" style={{ marginTop: space.xs }}>
              El precio base incluye empaque y etiqueta personalizada.
            </Txt>
            <View style={{ gap: space.md, marginTop: space.xl }}>
              {KIT_SIZES.map((s, i) => (
                <Pressable key={s.label} onPress={() => { setSize(s.label); if (items.length > s.max) setItems(items.slice(0, s.max)); }} testID={`kit-size-${s.label}`} style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: size === s.label ? colors.onSurface : colors.border }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.lavenderSoft, width: 32 + i * 10, height: 32 + i * 10 }]}>
                    <Ic name="package" size={16 + i * 3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{s.label}</Txt>
                    <Txt v="caption">{s.text}</Txt>
                  </View>
                  <Txt v="medium">{money(s.base)}</Txt>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {step === 3 && (
          <>
            <Txt v="h1">¿Qué te gustaría incluir?</Txt>
            <Txt v="caption" style={{ marginTop: space.xs, marginBottom: space.xl }}>
              Elige categorías o sáltalo para ver todo.
            </Txt>
            <ChipRow>
              {CATEGORIES.map((c) => (
                <Chip key={c.label} label={c.label} icon={c.icon} selected={cats.includes(c.label)} onPress={() => setCats(cats.includes(c.label) ? cats.filter((x) => x !== c.label) : [...cats, c.label])} testID={`kit-cat-${c.label}`} />
              ))}
            </ChipRow>
          </>
        )}
        {step === 4 && (
          <>
            <Txt v="h2">Elige hasta {max} artículos</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, alignItems: "center" }}>
              <Chip label={cats.length ? "Mis categorías" : "Todo"} selected={!catFilter} onPress={() => setCatFilter("")} testID="kit-filter-all" />
              {CATEGORIES.map((c) => (
                <Chip key={c.label} label={c.label} selected={catFilter === c.label} onPress={() => setCatFilter(c.label)} testID={`kit-filter-${c.label}`} />
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: space.md }}>
              {visible.map((p) => (
                <ProductCard key={p.id} p={p} selected={items.some((i) => i.product_id === p.id)} onPress={() => toggleItem(p.id)} testID={`kit-product-${p.id}`} />
              ))}
            </View>
          </>
        )}
        {step === 5 && (
          <>
            <Txt v="h1">Vista previa</Txt>
            <Txt v="caption" style={{ marginTop: space.xs }}>
              {[context, size, forWho === "other" ? `Para ${forName}` : "Para mí"].join(" · ")}
            </Txt>
            <View style={[styles.box, { backgroundColor: colors.sand }]} testID="kit-preview-box">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {items.map((i) => (
                  <ProductImage key={i.product_id} product={pmap[i.product_id]} height={64} style={{ width: 64 }} />
                ))}
              </View>
              <Txt v="title" style={{ marginTop: space.md }}>
                {name || `Kit · ${context}`}
              </Txt>
            </View>
            {items.map((i) => {
              const p = pmap[i.product_id];
              if (!p) return null;
              return (
                <View key={i.product_id} style={[styles.item, { borderBottomColor: colors.divider }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                    <View style={{ flex: 1 }}>
                      <Txt v="medium">{p.name}</Txt>
                      <Txt v="caption">{[money(p.price), i.options.color, i.options.text ? `“${i.options.text}”` : null].filter(Boolean).join(" · ")}</Txt>
                    </View>
                    {p.colors?.length || p.personalize_text ? <Btn label="Personalizar" small variant="ghost" onPress={() => setEditing(editing === p.id ? null : p.id)} testID={`kit-personalize-${p.id}`} /> : null}
                    <Pressable onPress={() => toggleItem(p.id)} hitSlop={8} testID={`kit-remove-${p.id}`}>
                      <Ic name="x" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                  {editing === p.id ? (
                    <View style={{ marginTop: space.md }}>
                      {p.colors?.length ? (
                        <ChipRow>
                          {p.colors.map((c: string) => (
                            <Chip key={c} label={c} selected={i.options.color === c} onPress={() => setOpt(p.id, "color", c)} testID={`kit-opt-${p.id}-${c}`} />
                          ))}
                        </ChipRow>
                      ) : null}
                      {p.personalize_text ? <Field value={i.options.text || ""} onChangeText={(v) => setOpt(p.id, "text", v)} placeholder="Iniciales o mensaje" maxLength={24} testID={`kit-opt-text-${p.id}`} style={{ marginTop: space.md }} /> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
            <View style={[styles.total, { borderTopColor: colors.onSurface }]}>
              <Txt v="caption">Base {size.toLowerCase()} {money(base)}</Txt>
              <Txt v="h2" testID="kit-total">
                {money(total)}
              </Txt>
            </View>
            <Field label="Nombre del kit" value={name} onChangeText={setName} placeholder={`Kit · ${context}`} testID="kit-name-input" />
            <Field label="Nota o dedicatoria (opcional)" value={note} onChangeText={setNote} multiline testID="kit-note-input" />
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1.5 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.lg, padding: space.lg, marginVertical: space.xl },
  item: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: space.lg, marginBottom: space.lg, borderTopWidth: 1, marginTop: space.md },
});
