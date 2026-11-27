// Visual option cards for questionnaires: icon, pastel tint, clear selected state, and an "add your own" field with a visible button.
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { useMotionAllowed } from "@/src/motion";
import { Btn, Ic, Txt, tap } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

export type Opt = { label: string; icon?: string };
const TINTS = ["sage", "lavender", "butter", "sky", "coral", "mauve"] as const;

/** Text field + visible "Agregar" button (never depends on the keyboard's Enter key). */
export function AddOwn({ onAdd, placeholder = "Escribe tu propia respuesta", testID }: { onAdd: (v: string) => void; placeholder?: string; testID: string }) {
  const { colors } = useTheme();
  const [v, setV] = useState("");
  const add = () => {
    const c = v.trim();
    if (c) onAdd(c);
    setV("");
  };
  return (
    <View style={styles.addRow}>
      <TextInput value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={colors.muted} onSubmitEditing={add} returnKeyType="done" testID={`${testID}-custom-input`}
        style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
      <Btn label="Agregar" small icon="plus" variant="secondary" disabled={!v.trim()} onPress={add} testID={`${testID}-custom-add`} />
    </View>
  );
}

export function OptionCards({ label, hint, options, value, onChange, multi = true, allowCustom, columns = 2, testID }: {
  label?: string; hint?: string; options: Opt[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean; allowCustom?: boolean; columns?: 1 | 2; testID: string;
}) {
  const { colors } = useTheme();
  const still = !useMotionAllowed();
  const known = options.map((o) => o.label);
  const all: Opt[] = [...options, ...value.filter((v) => !known.includes(v)).map((v) => ({ label: v, icon: "pencil" }))];
  const toggle = (o: string) => {
    tap();
    if (multi) onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
    else onChange(value.includes(o) ? [] : [o]);
  };
  return (
    <View style={{ marginBottom: space.xl }}>
      {label ? <Txt v="title" style={{ marginBottom: 2 }}>{label}</Txt> : null}
      <Txt v="caption" style={{ marginBottom: space.md }}>{hint || (multi ? "Puedes elegir varias." : "Elige una.")}</Txt>
      <View style={styles.grid}>
        {all.map((o, i) => {
          const on = value.includes(o.label);
          const tint = TINTS[i % TINTS.length];
          return (
            <Pressable key={o.label} onPress={() => toggle(o.label)} testID={`${testID}-${o.label}`} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={{ checked: on }} accessibilityLabel={o.label}
              style={({ pressed }) => [styles.card, columns === 1 ? styles.one : styles.two, { backgroundColor: on ? (colors as any)[tint] : colors.surfaceSecondary, borderColor: on ? colors.onSurface : colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <View style={[styles.icon, { backgroundColor: on ? colors.surfaceSecondary : (colors as any)[`${tint}Soft`] }]}><Ic name={o.icon || "circle"} size={18} /></View>
              <Txt v="medium" style={styles.text}>{o.label}</Txt>
              {on ? (
                <Animated.View entering={still ? undefined : ZoomIn.duration(160)} style={[styles.tick, { backgroundColor: colors.surfaceInverse }]}><Ic name="check" size={12} color={colors.onSurfaceInverse} /></Animated.View>
              ) : multi ? <View style={[styles.tick, { borderWidth: 1.5, borderColor: colors.borderStrong }]} /> : null}
            </Pressable>
          );
        })}
      </View>
      {allowCustom ? <AddOwn testID={testID} onAdd={(c) => onChange(multi ? (value.includes(c) ? value : [...value, c]) : [c])} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.sm },
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: 10, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" },
  two: { width: "48.6%" },
  one: { width: "100%" },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 17 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  input: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.md, fontFamily: fonts.body, fontSize: 15 },
});
