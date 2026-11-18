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
  surface: "#F8F5F0",
  onSurface: "#292929",
  surfaceSecondary: "#FFFEFC",
  onSurfaceSecondary: "#252525",
  surfaceTertiary: "#F0EBE4",
  onSurfaceTertiary: "#252525",
  surfaceInverse: "#292929",
  onSurfaceInverse: "#FFFFFF",
  brand: "#9EBCA5",
  brandPrimary: "#9EBCA5",
  onBrandPrimary: "#1F3A27",
  brandSecondary: "#CFC3DF",
  onBrandSecondary: "#252525",
  brandTertiary: "#E2BFB0",
  onBrandTertiary: "#252525",
  success: "#9EBCA5",
  onSuccess: "#1A251D",
  warning: "#E3CB8E",
  onWarning: "#252525",
  error: "#E2BFB0",
  onError: "#252525",
  info: "#CFC3DF",
  onInfo: "#252525",
  border: "#E7E1D9",
  borderStrong: "#D9D2C8",
  divider: "#EEE9E2",
  muted: "#6B6B68",
  onBrand: "#1A251D",
  sage: "#9EBCA5",
  sageSoft: "#DCE8DD",
  lavender: "#CBC2D3",
  lavenderSoft: "#E8E2ED",
  coral: "#D9BFB3",
  coralSoft: "#F1E3DC",
  sand: "#F0EBE4",
  scrim: "rgba(37,37,37,0.55)",
  butter: "#D9D2C8",
  butterSoft: "#F0EBE4",
  sky: "#D9D2C8",
  skySoft: "#F0EBE4",
  shadow: "#8A6A3F",
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
  logo: "PJS-800", // logotype only — the rest of the UI uses Inter
  display: "Inter-600",
  displayBold: "Inter-700",
  displayMedium: "Inter-600",
  body: "Inter-400",
  bodyMedium: "Inter-500",
  bodyBold: "Inter-600",
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 12, md: 16, lg: 22, pill: 999 };
export const colors = themes.light;
