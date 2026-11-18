// layout.tsx

import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { C } from "@/shared/constants/studia-colors";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (error) console.warn("Font load failed:", error);
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 300,
          freezeOnBlur: true,
          contentStyle: { backgroundColor: C.lavenderSoft },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="learn-more" />
        <Stack.Screen name="explore" />

        <Stack.Screen name="student" />
        <Stack.Screen name="instructor" />
      </Stack>
    </SafeAreaProvider>
  );
}
