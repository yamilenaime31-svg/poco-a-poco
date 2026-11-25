import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { money } from "@/src/constants";
import { Badge, Btn, Ic, ProductImage, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

/** General tips from a reviewed public source, its precaution and links. Never a clinical recommendation. */
export function GuideInfo({ guide, testID }: { guide: any; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.lavenderSoft }]} testID={testID}>
      <Txt v="label">Lo que dicen las guías</Txt>
      {guide.tips.map((t: string, i: number) => (
        <View key={i} style={styles.tip}>
          <Txt v="caption" color={colors.onSurface}>•</Txt>
          <Txt v="caption" color={colors.onSurface} style={{ flex: 1 }}>{t}</Txt>
        </View>
      ))}
      {guide.precaution ? <Txt v="caption" color={colors.onSurface} style={{ marginTop: space.sm }}>Precaución: {guide.precaution}</Txt> : null}
      <View style={{ marginTop: space.sm }}>
        {guide.sources.map((s: any, i: number) => (
          <Pressable key={s.url} onPress={() => Linking.openURL(s.url)} hitSlop={6} style={styles.link} testID={`${testID}-source-${i}`}>
            <Txt v="caption" style={{ textDecorationLine: "underline" }}>Fuente: {s.name}</Txt>
          </Pressable>
        ))}
      </View>
      <Txt v="caption" style={{ marginTop: space.sm }}>Información general revisada ({guide.reviewed}). No sustituye la orientación de tu equipo médico; los artículos solo aportan comodidad.</Txt>
    </View>
  );
}

export function GuideCard({ k, compact }: { k: any; compact?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.card, compact && styles.compact, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`guide-card-${k.id}`}>
      {k.for_you ? <View style={{ alignSelf: "flex-start", marginBottom: space.sm }}><Badge label={k.for_you} tint="sage" /></View> : null}
      <Txt v="caption">{k.guide.label}</Txt>
      <Txt v="title" numberOfLines={2}>{k.name}</Txt>
      <View style={styles.imgs}>
        {k.items.slice(0, 4).map((i: any) => <ProductImage key={i.product_id} product={i.product} height={compact ? 44 : 52} style={{ width: compact ? 44 : 52, borderRadius: radius.sm }} />)}
        {k.items.length > 4 ? <View style={[styles.more, { backgroundColor: colors.surfaceTertiary, width: compact ? 44 : 52, height: compact ? 44 : 52 }]}><Txt v="caption">+{k.items.length - 4}</Txt></View> : null}
      </View>
      <Txt v="caption" color={colors.onSurface}>{k.items.length} artículos · {money(k.total)} (ejemplo) · envío incluido</Txt>
      {!compact ? (
        <>
          <Pressable onPress={() => setOpen(!open)} style={styles.toggle} testID={`guide-toggle-${k.id}`}>
            <Ic name={open ? "chevron-up" : "chevron-down"} size={16} />
            <Txt v="caption" style={{ textDecorationLine: "underline" }}>{open ? "Ocultar guía y fuentes" : "Ver guía y fuentes"}</Txt>
          </Pressable>
          {open ? <GuideInfo guide={k.guide} testID={`guide-info-${k.id}`} /> : null}
        </>
      ) : null}
      <Btn label="Ver kit" small variant="secondary" icon="arrow-right" onPress={() => router.push(`/kit/${k.id}`)} testID={`guide-open-${k.id}`} style={{ marginTop: space.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, padding: space.md, gap: 4 },
  tip: { flexDirection: "row", gap: 6 },
  link: { minHeight: 32, justifyContent: "center" },
  card: { borderRadius: radius.lg, padding: space.md, borderWidth: 0, marginBottom: space.md, gap: 4 },
  compact: { width: 240, marginBottom: 0 },
  imgs: { flexDirection: "row", gap: 6, marginVertical: space.sm },
  more: { borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
});
