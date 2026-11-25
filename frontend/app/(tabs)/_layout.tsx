import { Pressable, StyleSheet, Text, View } from "react-native";
import Lucide from "@react-native-vector-icons/lucide";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { useReminderSync } from "@/src/reminders";
import { fonts, useTheme } from "@/src/theme";
import { tap } from "@/src/ui";

const TABS = [
  { name: "index", label: "Inicio", icon: "house" },
  { name: "agenda", label: "Agenda", icon: "calendar" },
  { name: "mykits", label: "Kits", icon: "package" },
  { name: "organiza", label: "Organiza", icon: "layout-grid" },
  { name: "me", label: "Perfil", icon: "user-round" },
] as const;

/** AMODO tab bar: compact ink bar, light pill on the selected section, labels always visible. Sits in the layout (never over content). */
function AmodoTabBar({ state }: any) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.surface, paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
      <View style={[styles.bar, { backgroundColor: colors.surfaceInverse }]} accessibilityRole="tablist">
        {state.routes.map((route: any, i: number) => {
          const t = TABS.find((x) => x.name === route.name);
          if (!t) return null;
          const on = state.index === i;
          return (
            <Pressable key={route.key} testID={`tab-${t.name}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
              onPress={() => {
                tap();
                if (!on) router.navigate((t.name === "index" ? "/(tabs)" : `/(tabs)/${t.name}`) as any);
              }}
              style={[styles.item, on && { backgroundColor: colors.surface }]}>
              <Lucide name={t.icon as any} size={20} color={on ? colors.onSurface : colors.onSurfaceInverse} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: on ? colors.onSurface : colors.onSurfaceInverse }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, ready } = useAuth();
  useReminderSync();
  if (ready && !user) return <Redirect href="/landing" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <AmodoTabBar {...p} />}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />)}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderRadius: 26, padding: 5, gap: 2 },
  item: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 21, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontFamily: fonts.displayMedium, fontSize: 11, letterSpacing: -0.1 },
});
