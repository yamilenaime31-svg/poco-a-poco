import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { api, useApi } from "@/src/api";
import { PlusGate, usePlus } from "@/src/components/plus-gate";
import { MultiChoice } from "@/src/form";
import { useToast } from "@/src/toast";
import { Btn, Card, ErrorState, Ic, IconBtn, Loading, ProductImage, Screen, Section, Txt, mediaUrl, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

type Prefs = { colors: string[]; textures: string[]; accessories: string[]; styles: string[] };

/** Identidad y estilo (Plus): choose colours, textures and accessories; get catalogue matches and an AI inspiration board. */
export default function Style() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { plus } = usePlus();
  const q = useApi<any>(plus ? "/style" : null);
  const [d, setD] = useState<any>(null);
  const [prefs, setPrefs] = useState<Prefs>({ colors: [], textures: [], accessories: [], styles: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [making, setMaking] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setD(q.data);
    if (!dirty) setPrefs(q.data.prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const set = (k: keyof Prefs) => (v: string[]) => { setPrefs((p) => ({ ...p, [k]: v })); setDirty(true); };
  const any = prefs.colors.length + prefs.textures.length + prefs.accessories.length > 0;
  const save = async () => {
    setSaving(true);
    try {
      setD(await api("/style", { method: "PUT", body: prefs }));
      setDirty(false);
      return true;
    } catch (e: any) {
      toast.show(e.message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const inspire = async () => {
    if (dirty && !(await save())) return;
    setMaking(true);
    try {
      const img = await api("/style/inspiration", { method: "POST" });
      setD((x: any) => ({ ...x, images: [img, ...x.images].slice(0, x.max_images) }));
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setMaking(false);
    }
  };
  const removeImg = async (id: string) => {
    setD((x: any) => ({ ...x, images: x.images.filter((i: any) => i.id !== id) }));
    api(`/style/inspiration/${id}`, { method: "DELETE" }).catch(() => q.refetch());
  };

  return (
    <Screen title="Identidad y estilo" subtitle="Colores, texturas y accesorios, a tu modo" testID="style-screen">
      <PlusGate title="Tu estilo con AMODO Plus" text="Elige colores, texturas y accesorios y recibe propuestas visuales: artículos del catálogo que combinan y una imagen de inspiración. El catálogo completo sigue disponible con cualquier plan."
        preview={<Card><Txt v="title">Salvia · Algodón · Pañuelos</Txt><Txt v="caption">3 artículos que combinan contigo</Txt></Card>}>
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !d ? <Loading /> : (
          <>
            <Txt v="title" style={{ marginBottom: space.md }}>Colores que van contigo</Txt>
            <View style={styles.swatches} testID="style-colors">
              {d.options.colors.map((c: any) => {
                const on = prefs.colors.includes(c.id);
                return (
                  <Pressable key={c.id} testID={`style-color-${c.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={c.id}
                    onPress={() => { tap(); set("colors")(on ? prefs.colors.filter((x) => x !== c.id) : [...prefs.colors, c.id]); }} style={styles.swatch}>
                    <View style={[styles.dot, { backgroundColor: c.hex, borderColor: on ? colors.onSurface : colors.border, borderWidth: on ? 2 : 1 }]}>
                      {on ? <View style={[styles.tick, { backgroundColor: colors.surfaceSecondary }]}><Ic name="check" size={12} /></View> : null}
                    </View>
                    <Txt v="caption" color={colors.onSurface} style={{ fontSize: 11, lineHeight: 14, textAlign: "center" }} numberOfLines={2}>{c.id}</Txt>
                  </Pressable>
                );
              })}
            </View>
            <MultiChoice label="Texturas" options={d.options.textures} value={prefs.textures} onChange={set("textures")} testID="style-texture" />
            <MultiChoice label="Accesorios" options={d.options.accessories} value={prefs.accessories} onChange={set("accessories")} testID="style-accessory" />
            <MultiChoice label="Estilo (opcional)" options={d.options.styles} value={prefs.styles} onChange={set("styles")} testID="style-style" />
            <Btn label={dirty ? "Guardar y ver propuestas" : "Propuestas actualizadas"} icon="sparkles" loading={saving} disabled={!dirty} onPress={save} testID="style-save" />

            <Section title="Del catálogo, para ti" testID="style-proposals">
              {d.proposals.length === 0 ? <Txt v="caption">{any ? "Guarda tus elecciones para ver artículos que combinan. Si no aparece ninguno, prueba con otro color o accesorio." : "Elige colores, texturas o accesorios para ver propuestas."}</Txt> : d.proposals.map((p: any) => (
                <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} testID={`style-proposal-${p.id}`} style={[styles.prop, { borderBottomColor: colors.divider }]}>
                  <ProductImage product={p} height={72} style={{ width: 72 }} />
                  <View style={{ flex: 1 }}>
                    <Txt v="medium" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>{p.name}</Txt>
                    <Txt v="caption" numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>{p.why.join(" · ")}</Txt>
                    <Txt v="caption" color={colors.onSurface} style={{ fontSize: 12 }}>{p.available === false ? "Agotado por ahora" : p.tier === "premium" ? "Premium" : "Incluido en kit"}</Txt>
                  </View>
                  <IconBtn icon="package-plus" onPress={() => router.push({ pathname: "/kit-builder", params: { add: p.id } })} testID={`style-add-${p.id}`} />
                </Pressable>
              ))}
              {d.proposals.length ? <Txt v="caption" style={{ marginTop: space.sm }}>Imágenes ilustrativas. Toca la caja para empezar un kit con ese artículo.</Txt> : null}
            </Section>

            <Section title="Inspiración visual" testID="style-inspiration">
              <Btn label={making ? "Creando tu imagen…" : "Crear imagen de inspiración"} variant="secondary" icon="image-plus" loading={making} disabled={!any} onPress={inspire} testID="style-inspire" />
              <Txt v="caption" style={{ marginTop: space.sm }}>{making ? "Tarda unos segundos. Puedes quedarte en esta pantalla." : "Cuenta como una interacción con el asistente."}</Txt>
              {d.images.map((img: any) => (
                <View key={img.id} style={{ marginTop: space.md }} testID={`style-image-${img.id}`}>
                  <Image source={{ uri: mediaUrl(img.image) }} style={[styles.img, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" transition={200} accessibilityLabel="Imagen de inspiración creada con IA" />
                  <View style={styles.imgFoot}>
                    <Txt v="caption" style={{ flex: 1, fontSize: 12 }} numberOfLines={2}>Creada con IA · {[...img.prefs.colors, ...img.prefs.textures, ...img.prefs.accessories].join(", ")}</Txt>
                    <IconBtn icon="trash-2" onPress={() => removeImg(img.id)} testID={`style-image-delete-${img.id}`} />
                  </View>
                </View>
              ))}
              <Txt v="caption" style={{ marginTop: space.md }}>{d.note}</Txt>
            </Section>
          </>
        )}
      </PlusGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: "row", flexWrap: "wrap", marginBottom: space.lg, rowGap: space.md },
  swatch: { width: "20%", alignItems: "center", gap: 4, minHeight: 64 },
  dot: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  prop: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  img: { width: "100%", aspectRatio: 1, borderRadius: radius.md },
  imgFoot: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
