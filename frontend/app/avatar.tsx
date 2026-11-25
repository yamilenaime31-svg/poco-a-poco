import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { AVATAR_CROPS, AVATAR_OPTIONS, AvatarSvg, DEFAULT_AVATAR } from "@/src/components/avatar";
import { useToast } from "@/src/toast";
import { Btn, Ic, Screen, Txt, tap } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

type Crop = keyof typeof AVATAR_CROPS;

const CATEGORIES: { key: string; label: string; icon: string; groups: string[] }[] = [
  { key: "face", label: "Rostro", icon: "scan-face", groups: ["face"] },
  { key: "skin", label: "Piel", icon: "palette", groups: ["skin"] },
  { key: "eyes", label: "Ojos", icon: "eye", groups: ["eyes"] },
  { key: "brows", label: "Cejas", icon: "spline", groups: ["brows"] },
  { key: "mouth", label: "Boca", icon: "smile", groups: ["mouth"] },
  { key: "hair", label: "Cabello", icon: "scissors", groups: ["hair", "hairColor"] },
  { key: "acc", label: "Accesorios", icon: "glasses", groups: ["headwear", "headColor", "glasses", "accessory"] },
  { key: "clothes", label: "Ropa", icon: "shirt", groups: ["clothes", "clothColor"] },
  { key: "bg", label: "Fondo", icon: "image", groups: ["bg", "bgShape"] },
];

const CROP: Record<string, Crop> = { face: "head", eyes: "eyes", brows: "eyes", mouth: "mouth", hair: "head", headwear: "head", glasses: "eyes", accessory: "face", clothes: "full" };
const COLS = 4;
const DARK = ["#292929", "#2B2B2B", "#5C3A21", "#5A3825", "#8D5524"];

export default function AvatarEditor() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { user, updateMe } = useAuth();
  const [a, setA] = useState<Record<string, string>>({ ...DEFAULT_AVATAR, ...(user?.profile?.avatar || {}) });
  const [cat, setCat] = useState("face");
  const [saving, setSaving] = useState(false);
  const current = CATEGORIES.find((c) => c.key === cat)!;
  const contentW = Math.min(width, 560) - space.xl * 2;
  const thumb = Math.floor((contentW - space.sm * (COLS - 1)) / COLS);

  const pick = (group: string, value: string) => {
    tap();
    setA({ ...a, [group]: value });
  };

  const save = async (value: any) => {
    setSaving(true);
    try {
      await updateMe({ profile: { avatar: value } });
      toast.show(value ? "Tu avatar se guardó" : "Quitamos tu avatar");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const renderGroup = (group: string) => {
    const opt = AVATAR_OPTIONS[group];
    if (opt.colors)
      return (
        <View style={styles.swatches}>
          {opt.values.map((c) => {
            const on = a[group] === c;
            return (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`${opt.label} ${c}`} accessibilityState={{ selected: on }} onPress={() => pick(group, c)} testID={`avatar-opt-${group}-${c}`}
                style={[styles.swatch, { backgroundColor: c, borderColor: on ? colors.onSurface : colors.border, borderWidth: on ? 2.5 : 1 }]}>
                {on ? <Ic name="check" size={16} color={DARK.includes(c) ? "#FFFFFF" : "#292929"} /> : null}
              </Pressable>
            );
          })}
        </View>
      );
    const rows: string[][] = [];
    for (let i = 0; i < opt.values.length; i += COLS) rows.push(opt.values.slice(i, i + COLS));
    return (
      <View style={{ gap: space.sm }}>
        {rows.map((r) => (
          <View key={r[0]} style={{ flexDirection: "row", gap: space.sm }}>
            {r.map((v) => {
              const on = a[group] === v;
              return (
                <Pressable key={v} accessibilityRole="button" accessibilityLabel={v} accessibilityState={{ selected: on }} onPress={() => pick(group, v)} testID={`avatar-opt-${group}-${v}`} style={{ width: thumb, alignItems: "center" }}>
                  <View style={[styles.thumb, { width: thumb, height: thumb, backgroundColor: colors.surfaceSecondary, borderColor: on ? colors.onSurface : colors.border, borderWidth: on ? 2 : 1 }]}>
                    <AvatarSvg a={{ ...a, [group]: v }} size={thumb - 10} crop={CROP[group] || "full"} />
                    {on ? <View style={[styles.tick, { backgroundColor: colors.surfaceInverse }]}><Ic name="check" size={10} color={colors.onSurfaceInverse} /></View> : null}
                  </View>
                  <Txt v="caption" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, marginTop: 4, textAlign: "center" }} color={on ? colors.onSurface : colors.muted}>{v}</Txt>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen title="Mi avatar" testID="avatar-screen" footer={
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {user?.profile?.avatar ? <Btn label="Quitar" variant="ghost" onPress={() => save(null)} testID="avatar-remove-button" style={{ flex: 1 }} /> : null}
        <Btn label="Guardar avatar" icon="check" loading={saving} onPress={() => save(a)} testID="avatar-save-button" style={{ flex: 2 }} />
      </View>
    }>
      <View style={{ alignItems: "center" }} testID="avatar-preview">
        <View style={{ borderRadius: 80, overflow: "hidden" }}><AvatarSvg a={a} size={150} /></View>
        <Txt v="caption" style={{ marginTop: space.sm, textAlign: "center" }}>Represéntate como quieras. Puedes cambiarlo cuando quieras.</Txt>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl, marginTop: space.lg, flexGrow: 0 }} contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.xl }}>
        {CATEGORIES.map((c) => {
          const on = c.key === cat;
          return (
            <Pressable key={c.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(); setCat(c.key); }} testID={`avatar-group-${c.key}`} style={styles.tab}>
              <View style={[styles.tabIcon, { backgroundColor: on ? colors.sageSoft : colors.surfaceSecondary, borderColor: on ? colors.sage : colors.border }]}>
                <Ic name={c.icon} size={20} />
              </View>
              <Txt v="caption" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }} color={on ? colors.onSurface : colors.muted}>{c.label}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: space.md }} testID={`avatar-panel-${cat}`}>
        {current.groups.map((g, i) => (
          <View key={g} style={{ marginTop: i ? space.lg : 0 }}>
            {current.groups.length > 1 ? <Txt v="label" style={{ marginBottom: space.sm }}>{AVATAR_OPTIONS[g].label}</Txt> : null}
            {renderGroup(g)}
          </View>
        ))}
      </View>

      <View style={[styles.note, { backgroundColor: colors.surfaceSecondary }]}>
        <Ic name="image" size={16} color={colors.muted} />
        <Txt v="caption" style={{ flex: 1 }}>Usar una fotografía propia estará disponible próximamente.</Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: { width: 70, alignItems: "center", gap: 4, paddingVertical: 2 },
  tabIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  thumb: { borderRadius: radius.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tick: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  note: { marginTop: space.xl, padding: space.md, borderRadius: radius.md, flexDirection: "row", gap: space.sm, alignItems: "center" },
});
