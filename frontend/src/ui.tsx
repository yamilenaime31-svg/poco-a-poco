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
  ScrollView,
} from "react-native";
import Lucide from "@react-native-vector-icons/lucide";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Company } from "@/src/art";
import { categoryOf, tintOf } from "@/src/constants";
import { fonts, radius, space, useTheme } from "@/src/theme";

/** True inside a pastel surface: secondary text switches to ink so it stays WCAG AA. */
export const OnTint = React.createContext(false);

export const tap = () => Haptics.selectionAsync().catch(() => {});

export function Ic({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Lucide name={name as any} size={size} color={color ?? colors.onSurface} />;
}

const VARIANTS: Record<string, TextStyle & { fontSize: number; lineHeight: number }> = {
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 39, letterSpacing: -1 },
  h1: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  section: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  title: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  medium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.displayMedium, fontSize: 13, lineHeight: 17, letterSpacing: -0.1 },
};

export function Txt({ v = "body", color, style, children, ...rest }: TextProps & { v?: keyof typeof VARIANTS | string; color?: string }) {
  const { colors } = useTheme();
  const { textScale } = useAuth();
  const onTint = React.useContext(OnTint);
  const base = VARIANTS[v] || VARIANTS.body;
  const c = color ?? ((v === "caption" || v === "label") && !onTint ? colors.muted : colors.onSurface);
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
      <Text style={{ fontFamily: fonts.logo, fontSize: size, letterSpacing: -size * 0.06, color: color ?? colors.onSurface, lineHeight: size * 1.15 }}>amodo</Text>
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
    accent: { bg: colors.lavender, fg: colors.onSurface, bd: colors.lavender },
    secondary: { bg: colors.surfaceTertiary, fg: colors.onSurface, bd: colors.surfaceTertiary },
    ghost: { bg: "transparent", fg: colors.onSurface, bd: "transparent" },
    danger: { bg: colors.error, fg: colors.onError, bd: colors.error },
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
        { backgroundColor: map.bg, borderColor: map.bd, opacity: disabled ? 0.4 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
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
        { backgroundColor: selected ? colors.surfaceInverse : colors.surfaceSecondary, borderColor: selected ? colors.surfaceInverse : colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      {selected ? <Ic name="check" size={14} color={colors.onSurfaceInverse} /> : icon ? <Ic name={icon} size={14} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.onSurfaceInverse : colors.onSurface }]}>{label}</Text>
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
        <Txt v="label" color={colors.onSurface} style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[
          styles.input,
          { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.onError : colors.border, color: colors.onSurface, fontSize: 15 * textScale },
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
      {badge ? <View style={[styles.dot, { backgroundColor: colors.coralDeep, borderColor: colors.surfaceSecondary }]} /> : null}
    </Pressable>
  );
}

export function Header({ title, back = true, right, subtitle, onBack }: { title?: string; back?: boolean; right?: React.ReactNode; subtitle?: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        {back ? (
          <IconBtn icon="chevron-left" testID="header-back-button" onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace("/"))} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0, marginHorizontal: back ? space.md : 0 }}>
          {title ? (
            <Txt v="h2" numberOfLines={2} testID="screen-title">
              {title}
            </Txt>
          ) : null}
          {subtitle ? (
            <Txt v="caption" numberOfLines={2}>
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
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
  overlay?: React.ReactNode;
};

export function Screen({ title, subtitle, back = true, right, children, footer, scroll = true, refreshing, onRefresh, testID, overlay, onBack }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={testID}>
      <Header title={title} subtitle={subtitle} back={back} right={right} onBack={onBack} />
      {scroll ? (
        <KeyboardAwareScrollView
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: footer ? space.xl : insets.bottom + space.xxl }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} /> : undefined}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.surface }]}>{footer}</View>
      ) : null}
      {overlay}
    </View>
  );
}

export function Card({ children, style, tint, testID, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string; testID?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const bg = tint ? tintOf(colors, tint).bg : colors.surfaceSecondary;
  const body = <OnTint.Provider value={!!tint}>{children}</OnTint.Provider>;
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: bg, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}>
        {body}
      </Pressable>
    );
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: bg }, style]}>
      {body}
    </View>
  );
}

export function Section({ title, action, onAction, children, testID, style }: { title: string; action?: string; onAction?: () => void; children?: React.ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginTop: space.xxl }, style]} testID={testID}>
      <View style={styles.sectionHead}>
        <Txt v="section" style={{ flex: 1 }}>{title}</Txt>
        {action ? (
          <Pressable onPress={onAction} hitSlop={10} testID={testID ? `${testID}-action` : undefined}>
            <View style={styles.sectionAction}>
              <Txt v="label" color={colors.onSurface}>{action}</Txt>
              <Ic name="arrow-right" size={14} />
            </View>
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
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
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
      <View style={styles.emptyArt}>
        <Company size={104} />
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceInverse }]}>
          <Ic name={icon} size={16} color={colors.onSurfaceInverse} />
        </View>
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
      <ActivityIndicator color={colors.onSurface} />
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

export const mediaUrl = (u: string) => (u.startsWith("/") ? `${process.env.EXPO_PUBLIC_BACKEND_URL}${u}` : u);

export function ProductImage({ product, height = 140, style }: { product?: { image?: string | null; category?: string }; height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const cat = categoryOf(product?.category);
  return (
    <View style={[{ height, borderRadius: radius.sm, backgroundColor: tintOf(colors, cat.tint).soft, alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      {product?.image ? (
        <Image source={{ uri: mediaUrl(product.image) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <Ic name={cat.icon} size={Math.min(32, height * 0.26)} />
      )}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onValueChange, testID }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Txt v="medium">{label}</Txt>
        {hint ? <Txt v="caption">{hint}</Txt> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onValueChange} trackColor={{ true: colors.onSurface, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />
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
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }} testID="progress-bar">
      <View style={{ width: `${Math.max(4, Math.min(100, value * 100))}%`, height: 8, backgroundColor: colors.onSurface, borderRadius: 4 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderWidth: 1 },
  btnSmall: { minHeight: 44, paddingHorizontal: space.lg },
  btnText: { fontFamily: fonts.displayMedium, fontSize: 15, letterSpacing: -0.2 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.lg, fontFamily: fonts.body },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 9, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
  card: { borderRadius: radius.lg, padding: space.lg },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginBottom: space.md, minHeight: 28 },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 8, minHeight: 60 },
  rowIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyArt: { marginBottom: space.md, alignItems: "center" },
  emptyIcon: { position: "absolute", right: -6, bottom: -4, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 10, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  badgeText: { fontFamily: fonts.displayMedium, fontSize: 12 },
  fab: { position: "absolute", right: space.xl, height: 56, minWidth: 56, paddingHorizontal: 20, borderRadius: 28, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, maxHeight: "85%" },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: space.md, marginTop: -8 },
});
