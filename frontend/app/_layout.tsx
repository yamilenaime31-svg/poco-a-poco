import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider, useAuth } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";
import { ToastProvider } from "@/src/toast";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  // Fonts + the icon font are loaded (prewarmed) up front so icons render in Expo Go.
  const [loaded, error] = useFonts({
    Lucide: require("@react-native-vector-icons/lucide/fonts/Lucide.ttf"),
    "PJS-600": require("../assets/fonts/PJS-600.ttf"),
    "PJS-700": require("../assets/fonts/PJS-700.ttf"),
    "PJS-800": require("../assets/fonts/PJS-800.ttf"),
    "Inter-400": require("../assets/fonts/Inter-400.ttf"),
    "Inter-500": require("../assets/fonts/Inter-500.ttf"),
    "Inter-600": require("../assets/fonts/Inter-600.ttf"),
    "Inter-700": require("../assets/fonts/Inter-700.ttf"),
  });

  if (!loaded && !error) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.sage} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <AuthGate />
              </ToastProvider>
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

/** Screens mount only after the saved session is restored, so deep links / cold starts never call the API without a token. */
function AuthGate() {
  const { ready } = useAuth();
  if (!ready)
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.sage} />
      </View>
    );
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
});
