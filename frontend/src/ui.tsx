import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Lucide from "@react-native-vector-icons/lucide";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { categoryOf, tintOf } from "@/src/constants";
import { fonts, radius, space, useTheme } from "@/src/theme";

export const tap = () => Haptics.selectionAsync().catch(() => {});

export function Ic({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Lucide name={name as any} size={size} color={color ?? colors.onSurface} />;
}

const VARIANTS: Record<string, TextStyle & { fontSize: number; lineHeight: number }> = {
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  title: { fontFamily: fonts.displayMedium, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  medium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
};

export function Txt({ v = "body", color, style, children, ...rest }: TextProps & { v?: keyof typeof VARIANTS | string; color?: string }) {
  const { colors } = useTheme();
  const { textScale } = useAuth();
  const base = VARIANTS[v] || VARIANTS.body;
  const c = color ?? (v === "caption" || v === "label" ? colors.muted : colors.onSurface);
  return (
    <Text
      {...rest}
      style={[base, { color: c }, textScale !== 1 && { fontSize: base.fontSize * textScale, lineHeight: base.lineHeight * textScale }, style]}
    >
      {children}
    </Text>
  );
}

export function Logo({ size = 28, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }} testID="amodo-logo">
      <Text style={{ fontFamily: fonts.displayBold, fontSize: size, letterSpacing: -size * 0.06, color: color ?? colors.onSurface, lineHeight: size * 1.15 }}>amodo</Text>
      <View style={{ width: size * 0.22, height: size * 0.22, borderRadius: size, backgroundColor: colors.sage, marginLeft: 2, marginBottom: size * 0.2 }} />
    </View>
  );
}

type BtnProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Btn({ label, onPress, variant = "primary", icon, loading, disabled, testID, small, style }: BtnProps) {
  const { colors } = useTheme();
  const map = {
    primary: { bg: colors.surfaceInverse, fg: colors.onSurfaceInverse, bd: colors.surfaceInverse },
    accent: { bg: colors.brandPrimary, fg: colors.onBrandPrimary, bd: colors.brandPrimary },
    secondary: { bg: colors.surfaceSecondary, fg: colors.onSurface, bd: colors.border },
    ghost: { bg: "transparent", fg: colors.onSurface, bd: "transparent" },
    danger: { bg: colors.coralSoft, fg: colors.onSurface, bd: colors.coralSoft },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: map.bg, borderColor: map.bd, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={map.fg} />
      ) : (
        <>
          {icon ? <Ic name={icon} size={small ? 16 : 18} color={map.fg} /> : null}
          <Text style={[styles.btnText, small && { fontSize: 14 }, { color: map.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, testID, icon }: { label: string; selected?: boolean; onPress?: () => void; testID?: string; icon?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.sageSoft : colors.surfaceSecondary, borderColor: selected ? colors.sage : colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {selected ? <Ic name="check" size={14} /> : icon ? <Ic name={icon} size={14} /> : null}
      <Text style={[styles.chipText, { color: colors.onSurface }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipWrap}>{children}</View>;
}

export function Field({ label, hint, error, testID, multiline, style, ...rest }: TextInputProps & { label?: string; hint?: string; error?: string; testID?: string }) {
  const { colors } = useTheme();
  const { textScale } = useAuth();
  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? (
        <Txt v="medium" style={{ marginBottom: 6, fontSize: 14 }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[
          styles.input,
          { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.coral : colors.border, color: colors.onSurface, fontSize: 15 * textScale },
          multiline && { minHeight: 104, textAlignVertical: "top", paddingTop: 14 },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Txt v="caption" color={colors.onSurface} style={{ marginTop: 6 }} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt v="caption" style={{ marginTop: 6 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function IconBtn({ icon, onPress, testID, badge }: { icon: string; onPress?: () => void; testID?: string; badge?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}>
      <Ic name={icon} size={20} />
      {badge ? <View style={[styles.dot, { backgroundColor: colors.coral, borderColor: colors.surfaceSecondary }]} /> : null}
    </Pressable>
  );
}

export function Header({ title, back = true, right, subtitle }: { title?: string; back?: boolean; right?: React.ReactNode; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
      <View style={styles.headerRow}>
        {back ? (
          <IconBtn icon="chevron-left" testID="header-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        ) : null}
        <View style={{ flex: 1, marginHorizontal: back ? space.md : 0 }}>
          {title ? (
            <Txt v="h2" numberOfLines={1} testID="screen-title">
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt v="caption" numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

type ScreenProps = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
  overlay?: React.ReactNode;
};

export function Screen({ title, subtitle, back = true, right, children, footer, scroll = true, refreshing, onRefresh, testID, overlay }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={testID}>
      <Header title={title} subtitle={subtitle} back={back} right={right} />
      {scroll ? (
        <KeyboardAwareScrollView
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.xl, paddingBottom: footer ? space.xl : insets.bottom + space.xxl }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.sage} /> : undefined}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg, backgroundColor: colors.surface, borderTopColor: colors.divider }]}>{footer}</View>
      ) : null}
      {overlay}
    </View>
  );
}

export function Card({ children, style, tint, testID, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string; testID?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const bg = tint ? tintOf(colors, tint).bg : colors.surfaceSecondary;
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: bg, opacity: pressed ? 0.88 : 1 }, style]}>
        {children}
      </Pressable>
    );
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: bg }, style]}>
      {children}
    </View>
  );
}

export function Section({ title, action, onAction, children, testID, style }: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: space.xl }, style]} testID={testID}>
      <View style={styles.sectionHead}>
        <Txt v="label">{title}</Txt>
        {action ? (
          <Pressable onPress={onAction} hitSlop={10} testID={testID ? `${testID}-action` : undefined}>
            <Txt v="medium" style={{ fontSize: 14, textDecorationLine: "underline" }}>
              {action}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  testID,
  tint,
  last,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  tint?: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const t = tintOf(colors, tint);
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 }]}
    >
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
          <Ic name={icon} size={18} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt v="medium" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="caption" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Ic name="chevron-right" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export function Empty({ icon = "leaf", title, text, action, onAction, testID }: { icon?: string; title: string; text?: string; action?: string; onAction?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty} testID={testID}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.sageSoft }]}>
        <Ic name={icon} size={26} />
      </View>
      <Txt v="title" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {text ? (
        <Txt v="caption" style={{ textAlign: "center", marginTop: 6, maxWidth: 300 }}>
          {text}
        </Txt>
      ) : null}
      {action ? <Btn label={action} onPress={onAction} small style={{ marginTop: space.lg }} testID={testID ? `${testID}-action` : undefined} /> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: space.xxxl, alignItems: "center" }} testID="loading-indicator">
      <ActivityIndicator color={colors.sage} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <Empty icon="cloud-off" title="No pudimos cargar esto" text={message || "Puede ser la conexión. Inténtalo de nuevo cuando quieras."} action={onRetry ? "Reintentar" : undefined} onAction={onRetry} testID="error-state" />;
}

export function Badge({ label, tint, testID }: { label: string; tint?: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: tintOf(colors, tint).bg }]}>
      <Text style={[styles.badgeText, { color: colors.onSurface }]}>{label}</Text>
    </View>
  );
}

export function ProductImage({ product, height = 140, style }: { product?: { image?: string | null; category?: string }; height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const cat = categoryOf(product?.category);
  const t = tintOf(colors, cat.tint);
  return (
    <View style={[{ height, borderRadius: radius.md, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      {product?.image ? (
        <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <>
          <View style={{ position: "absolute", width: height * 0.9, height: height * 0.9, borderRadius: height, backgroundColor: t.accent, opacity: 0.18, right: -height * 0.2, bottom: -height * 0.3 }} />
          <Ic name={cat.icon} size={Math.min(40, height * 0.28)} />
        </>
      )}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onValueChange, testID }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Txt v="medium">{label}</Txt>
        {hint ? <Txt v="caption">{hint}</Txt> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onValueChange} trackColor={{ true: colors.sage, false: colors.surfaceTertiary }} thumbColor={colors.surfaceSecondary} />
    </View>
  );
}

export function Fab({ onPress, testID, bottom, icon = "plus", label }: { onPress: () => void; testID?: string; bottom: number; icon?: string; label?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.fab, { bottom, backgroundColor: colors.surfaceInverse, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
    >
      <Ic name={icon} size={20} color={colors.onSurfaceInverse} />
      {label ? <Text style={[styles.btnText, { color: colors.onSurfaceInverse, fontSize: 14 }]}>{label}</Text> : null}
    </Pressable>
  );
}

export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]} testID={testID}>
        <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
        <View style={styles.sectionHead}>
          <Txt v="h2">{title}</Txt>
          <IconBtn icon="x" onPress={onClose} testID={testID ? `${testID}-close` : undefined} />
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 4, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }} testID="progress-bar">
      <View style={{ width: `${Math.max(4, Math.min(100, value * 100))}%`, height: 4, backgroundColor: colors.sage, borderRadius: 4 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderWidth: 1 },
  btnSmall: { minHeight: 44, paddingHorizontal: space.lg },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontFamily: fonts.body },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 9, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  header: { paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  card: { borderRadius: radius.lg, padding: space.lg, shadowColor: "#8A6A3F", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm, minHeight: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 14, minHeight: 56 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: space.md },
  badge: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  fab: { position: "absolute", right: space.xl, height: 56, minWidth: 56, paddingHorizontal: 18, borderRadius: 28, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.xl, maxHeight: "85%" },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: space.md, marginTop: -8 },
});
