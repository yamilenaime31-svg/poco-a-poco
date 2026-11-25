import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usesNativeTabs } from "@/src/navigation";
import { IconBtn, Logo, Txt } from "@/src/ui";
import { space, useTheme } from "@/src/theme";

/** Shared chrome for the four tab screens: sticky header with logo/title + bell. */
export function TabScreen({
  title,
  subtitle,
  unread,
  children,
  refreshing,
  onRefresh,
  right,
  testID,
  overlay,
  sticky,
}: {
  title?: string;
  subtitle?: string;
  unread?: number;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  right?: React.ReactNode;
  testID?: string;
  overlay?: (bottomChrome: number) => React.ReactNode;
  sticky?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={testID}>
      <View style={{ paddingTop: insets.top + space.xs, paddingHorizontal: space.xl, paddingBottom: space.sm, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, gap: space.sm }}>
          <View style={{ flex: 1 }}>{title ? <Txt v="h1" testID="tab-title">{title}</Txt> : <Logo size={26} />}</View>
          {right}
          <IconBtn icon="bell" badge={!!unread} onPress={() => router.push("/notifications")} testID="header-notifications-button" />
        </View>
        {subtitle ? <Txt v="caption" style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
      </View>
      {sticky}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: bottomChrome + space.xxl }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} /> : undefined}
      >
        {children}
      </ScrollView>
      {overlay?.(bottomChrome)}
    </View>
  );
}
