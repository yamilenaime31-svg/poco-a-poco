import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider } from "@/src/auth";
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
    "DMS-400": require("../assets/fonts/DMS-400.ttf"),
    "DMS-500": require("../assets/fonts/DMS-500.ttf"),
    "DMS-700": require("../assets/fonts/DMS-700.ttf"),
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
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
              </ToastProvider>
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
});
