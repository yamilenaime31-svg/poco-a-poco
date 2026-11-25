import React from "react";
import { StyleSheet, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Empty, Field, Screen, Txt } from "@/src/ui";
import { radius, space, useTheme } from "@/src/theme";

/** Admin-only wrapper: patients/caregivers without the admin flag see a neutral message (the API also returns 403). */
export function AdminScreen({ title, subtitle, children, footer, overlay, testID }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; overlay?: React.ReactNode; testID?: string }) {
  const { user } = useAuth();
  if (!user?.is_admin)
    return (
      <Screen title="Administración" testID="admin-forbidden">
        <Empty icon="lock" title="Sin acceso" text="Esta sección es solo para el equipo de AMODO." />
      </Screen>
    );
  return <Screen title={title} subtitle={subtitle} footer={footer} overlay={overlay} testID={testID}>{children}</Screen>;
}

export function Metric({ label, value, testID, bg }: { label: string; value: string | number; testID?: string; bg?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: bg || colors.surfaceSecondary }]} testID={testID}>
      <Txt v="caption" color={colors.onSurface} numberOfLines={2}>{label}</Txt>
      <Txt v="h2">{value}</Txt>
    </View>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  const arr = React.Children.toArray(children);
  const rows = [];
  for (let i = 0; i < arr.length; i += 2) rows.push(arr.slice(i, i + 2));
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
          {r}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

export function NumField({ label, value, onChange, testID }: { label: string; value: any; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Field label={label} value={value === null || value === undefined ? "" : String(value)} onChangeText={onChange} keyboardType="decimal-pad" testID={testID} />
    </View>
  );
}

export const tableRow = (colors: any) => ({ flexDirection: "row" as const, gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, alignItems: "center" as const });

const styles = StyleSheet.create({
  metric: { flex: 1, minWidth: 0, borderRadius: radius.md, borderWidth: 0, padding: space.md, gap: 2 },
});
