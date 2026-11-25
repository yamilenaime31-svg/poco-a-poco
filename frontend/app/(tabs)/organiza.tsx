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
import { Btn, Ic, Row, Section, Txt } from "@/src/ui";
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
    <TabScreen title="Organiza" subtitle="Todo lo tuyo, en un solo lugar" testID="organiza-screen">
      <View style={[styles.ai, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="organiza-ai-card">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={[styles.aiIcon, { backgroundColor: colors.butterSoft }]}><Ic name="sparkles" size={16} /></View>
          <Txt v="h2">¿Qué hay de nuevo?</Txt>
        </View>
        <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.sm }}>Cuéntame qué necesitas agregar o cambiar. Yo te ayudo a organizarlo.</Txt>
        <TextInput
          testID="organiza-input"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Ej. El jueves tengo consulta a las 10, mi mamá me va a llevar y tengo que pagar el estacionamiento"
          placeholderTextColor={colors.muted}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.border }]}
        />
        <Btn label="Organizar" icon="wand-sparkles" loading={busy} disabled={text.trim().length < 3} onPress={parse} testID="organiza-parse-button" />
        <View style={{ flexDirection: "row", gap: 6, marginTop: space.md }}>
          <Ic name="shield-check" size={14} color={colors.muted} />
          <Txt v="caption" style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>
            Solo enviamos este texto, sin tu nombre ni tus registros, a un modelo de IA para interpretarlo. No se usa para entrenar modelos y nada se guarda hasta que lo confirmes.
          </Txt>
        </View>
      </View>

      <Section title="Categorías">
        <TileGrid tiles={ORGANIZE_TILES.map((o) => ({ key: o.label, label: o.label, icon: o.icon, tint: o.tint, onPress: () => router.push(o.href as any), testID: `organiza-cat-${o.label}` }))} />
      </Section>

      <Section title="También">
        <Row icon="calendar-range" tint="sand" title="Mi próxima semana" subtitle="Lo que viene y lo que puedes preparar · Plus" onPress={() => router.push("/next-week")} testID="organiza-next-week" />
        <Row icon="clipboard-list" tint="sand" title="Listas de preparación" subtitle="Para citas, estudios y hospitalizaciones" onPress={() => router.push("/checklists")} testID="organiza-checklists" />
        <Row icon="chart-no-axes-column" tint="sand" title="Mi proceso" subtitle="Bienestar y actividades con resumen en PDF" onPress={() => router.push("/process")} testID="organiza-process" />
        <Row icon="sun" tint="coral" title="Mi día" onPress={() => router.push("/day")} testID="organiza-day" />
        <Row icon="radio" tint="lavender" title="Señales e historial" onPress={() => router.push("/signals")} testID="organiza-signals" />
        <Row icon="history" tint="butter" title="Historial personal" onPress={() => router.push("/history")} testID="organiza-history" last />
      </Section>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  ai: { borderRadius: radius.lg, padding: space.lg, marginTop: space.sm, borderWidth: StyleSheet.hairlineWidth },
  aiIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 96, borderRadius: radius.md, borderWidth: 1, padding: space.md, marginVertical: space.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
});
