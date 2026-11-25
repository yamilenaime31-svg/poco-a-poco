// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F7F5F0",
  onSurface: "#292D2B",
  surfaceSecondary: "#FDFCF9",
  onSurfaceSecondary: "#292D2B",
  surfaceTertiary: "#EFEBE4",
  onSurfaceTertiary: "#292D2B",
  surfaceInverse: "#292D2B",
  onSurfaceInverse: "#FDFCF9",
  brand: "#B7C6B8",
  brandPrimary: "#292D2B",
  onBrandPrimary: "#FDFCF9",
  brandSecondary: "#D9D4E1",
  onBrandSecondary: "#292D2B",
  brandTertiary: "#E7E0D6",
  onBrandTertiary: "#292D2B",
  success: "#B7C6B8",
  onSuccess: "#1F2A22",
  warning: "#E9DDBF",
  onWarning: "#4A3D1C",
  error: "#EED9D0",
  onError: "#7A3424",
  info: "#D9D4E1",
  onInfo: "#292D2B",
  border: "#E7E0D6",
  borderStrong: "#D6CEC2",
  divider: "#ECE7DF",
  muted: "#6A6D69",
  onBrand: "#1F2A22",
  sage: "#B7C6B8",
  sageSoft: "#E6ECE5",
  sageDeep: "#5E7462",
  lavender: "#D9D4E1",
  lavenderSoft: "#EEEBF2",
  coral: "#E7E0D6",
  coralSoft: "#F2EEE8",
  sand: "#E7E0D6",
  scrim: "rgba(41,45,43,0.5)",
  butter: "#E7E0D6",
  butterSoft: "#F2EEE8",
  sky: "#E7E0D6",
  skySoft: "#F2EEE8",
  shadow: "#5B5246",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}



export const fonts = {
  logo: "PJS-800", // logotype only — headings use Manrope, everything else Inter
  display: "Manrope-600",
  displayBold: "Manrope-700",
  displayMedium: "Manrope-600",
  body: "Inter-400",
  bodyMedium: "Inter-500",
  bodyBold: "Inter-600",
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const colors = themes.light;
