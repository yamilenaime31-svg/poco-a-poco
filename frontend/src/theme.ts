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
  surface: "#F7F6F2",
  onSurface: "#25282A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#25282A",
  surfaceTertiary: "#ECE9E1",
  onSurfaceTertiary: "#25282A",
  surfaceInverse: "#25282A",
  onSurfaceInverse: "#FFFFFF",
  brand: "#BEB1EE",
  brandPrimary: "#25282A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#BEB1EE",
  onBrandSecondary: "#25282A",
  brandTertiary: "#B9D6AE",
  onBrandTertiary: "#25282A",
  success: "#B9D6AE",
  onSuccess: "#25282A",
  warning: "#F3DA83",
  onWarning: "#25282A",
  error: "#FBD9CF",
  onError: "#8A2E1C",
  info: "#AFCBF0",
  onInfo: "#25282A",
  border: "#E5E2D9",
  borderStrong: "#BDB9AE",
  divider: "#ECE9E1",
  muted: "#5C6063",
  onBrand: "#25282A",
  // Pastels with presence. Soft = tinted surface, Deep = small marks that need contrast on ivory.
  sage: "#B9D6AE",
  sageSoft: "#E1EEDB",
  sageDeep: "#4F8A40",
  lavender: "#BEB1EE",
  lavenderSoft: "#E6E0F9",
  lavenderDeep: "#6F5BC4",
  coral: "#F6BA91",
  coralSoft: "#FCE3D2",
  coralDeep: "#C96A2B",
  butter: "#F3DA83",
  butterSoft: "#FAF0C9",
  butterDeep: "#A8851A",
  sky: "#AFCBF0",
  skySoft: "#DDE9F9",
  skyDeep: "#4479C2",
  mauve: "#E4C5DE",
  mauveSoft: "#F4E6F1",
  mauveDeep: "#A8629A",
  sand: "#E6E2D7",
  scrim: "rgba(37,40,42,0.5)",
  shadow: "#25282A",
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
  logo: "PJS-800", // logotype
  display: "PJS-700",
  displayBold: "PJS-800",
  displayMedium: "PJS-600",
  body: "DMS-400",
  bodyMedium: "DMS-500",
  bodyBold: "DMS-700",
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 44 };
export const radius = { sm: 12, md: 16, lg: 20, pill: 999 };
export const colors = themes.light;
