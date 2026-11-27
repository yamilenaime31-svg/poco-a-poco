import { useCallback, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { api } from "@/src/api";
import { TabScreen } from "@/src/components/tab-screen";
import { ORGANIZE_TILES } from "@/src/components/home-patient";
import { TileGrid } from "@/src/components/tile-grid";
import { today } from "@/src/constants";
import { organizeDraft } from "@/src/organize-store";
import { useToast } from "@/src/toast";
import { Spot } from "@/src/art";
import { Btn, Ic, Section, Txt } from "@/src/ui";
import { fonts, radius, space, useTheme } from "@/src/theme";

export default function Organiza() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [text, setText] = useState(organizeDraft.text);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => setText(organizeDraft.text), []));

  const parse = async () => {
    setBusy(true);
    try {
      const r = await api("/organize/parse", { method: "POST", body: { text, today: today() } });
      if (!r.items.length) return toast.show("No encontré algo para organizar. Prueba con más detalle.", "error");
      organizeDraft.text = text;
      organizeDraft.items = r.items.map((it: any) => ({ ...it, include: true }));
      router.push("/organize-review");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TabScreen title="Organiza" subtitle="Todo lo tuyo, a tu ritmo" testID="organiza-screen">
      <View style={[styles.ai, { backgroundColor: colors.surfaceInverse }]} testID="organiza-ai-card">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={[styles.aiIcon, { backgroundColor: colors.butter }]}><Spot name="ai" size={30} pop={colors.surfaceSecondary} /></View>
          <View style={{ flex: 1 }}>
            <Txt v="h2" color={colors.onSurfaceInverse}>Cuéntame y lo organizo</Txt>
            <Txt v="caption" color={colors.onSurfaceInverse}>Escribe como hablas. Tú confirmas antes de guardar.</Txt>
          </View>
        </View>
        <TextInput
          testID="organiza-input"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Ej. El jueves tengo consulta a las 10, mi mamá me va a llevar y tengo que pagar el estacionamiento"
          placeholderTextColor={colors.muted}
          style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface }]}
        />
        <Btn label="Organizar" icon="wand-sparkles" variant="accent" loading={busy} disabled={text.trim().length < 3} onPress={parse} testID="organiza-parse-button" />
        <View style={{ flexDirection: "row", gap: 6, marginTop: space.md }}>
          <Ic name="shield-check" size={14} color={colors.onSurfaceInverse} />
          <Txt v="caption" color={colors.onSurfaceInverse} style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>
            Solo enviamos este texto, sin tu nombre ni tus registros, a un modelo de IA para interpretarlo. No se usa para entrenar modelos y nada se guarda hasta que lo confirmes.
          </Txt>
        </View>
      </View>

      <Section title="Tus herramientas">
        <TileGrid tiles={ORGANIZE_TILES.map((o) => ({ key: o.label, label: o.label, icon: o.icon, tint: o.tint, spot: o.spot, onPress: () => router.push(o.href as any), testID: `organiza-cat-${o.label}` }))} />
      </Section>

      <Section title="Prepara y mira atrás">
        <TileGrid tiles={[
          { key: "next-week", label: "Mi próxima semana", hint: "Plus · anticípate", tint: "sky", spot: "week", href: "/next-week" },
          { key: "checklists", label: "Listas de preparación", tint: "lavender", spot: "checklist", href: "/checklists" },
          { key: "coverage", label: "Mi cobertura médica", tint: "mauve", spot: "heart", href: "/coverage" },
          { key: "process", label: "Mi proceso", tint: "sage", spot: "process", href: "/process" },
          { key: "day", label: "Mi día", tint: "butter", spot: "day", href: "/day" },
          { key: "signals", label: "Señales e historial", tint: "mauve", spot: "signals", href: "/signals" },
          { key: "history", label: "Historial personal", tint: "sand", spot: "history", href: "/history" },
        ].map((o) => ({ ...o, icon: "circle", onPress: () => router.push(o.href as any), testID: `organiza-${o.key}` }))} />
      </Section>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  ai: { borderRadius: 24, padding: space.lg, marginTop: space.sm },
  aiIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 96, borderRadius: radius.md, padding: space.md, marginVertical: space.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
});
