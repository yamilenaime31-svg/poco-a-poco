import { Platform } from "react-native";
import Lucide from "@react-native-vector-icons/lucide";
import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

const TABS = [
  { name: "index", label: "Inicio", icon: "house", sf: "house.fill" },
  { name: "agenda", label: "Agenda", icon: "calendar", sf: "calendar" },
  { name: "kits", label: "Kits", icon: "package", sf: "shippingbox" },
  { name: "profile", label: "Perfil", icon: "user-round", sf: "person.crop.circle" },
] as const;

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const { colors } = useTheme();
  if (ready && !user) return <Redirect href="/landing" />;

  if (usesNativeTabs)
    return (
      <NativeTabs>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused }) => <Lucide name={t.icon as any} size={22} color={color} style={{ opacity: focused ? 1 : 0.8 }} />,
          }}
        />
      ))}
    </Tabs>
  );
}
