import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Redirect,
  Stack,
  ThemeProvider as RouterThemeProvider,
  usePathname,
} from "expo-router";
import * as Font from "expo-font";
import { setAudioModeAsync } from "expo-audio";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import {
  CrimsonPro_400Regular,
  CrimsonPro_400Regular_Italic,
  CrimsonPro_600SemiBold,
} from "@expo-google-fonts/crimson-pro";
import { MaterialSymbols_400Regular } from "@expo-google-fonts/material-symbols";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { migrateLibrary } from "@/lib/annotations";
import { LIGHT, ThemeProvider, toNavTheme, useTheme } from "@/lib/theme";
import { LogoMark } from "@/components/ui";

const FONT_MAP = {
  CrimsonPro_400Regular,
  CrimsonPro_400Regular_Italic,
  CrimsonPro_600SemiBold,
  MaterialSymbols_400Regular,
};

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <SettingsProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </SettingsProvider>
    </ConvexProvider>
  );
}

function Root() {
  const { c, isDark } = useTheme();
  const { settings, ready } = useSettings();
  const [fontsReady, setFontsReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    void migrateLibrary();
  }, []);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  }, []);

  useEffect(() => {
    let alive = true;
    Font.loadAsync(FONT_MAP)
      .catch(() => undefined)
      .then(() => {
        if (alive) setFontsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!fontsReady || !ready) {
    return (
      <View style={styles.splash}>
        <LogoMark size={72} color={LIGHT.gold} />
      </View>
    );
  }

  const onboarded = settings.onboarded;
  const navTheme = toNavTheme(c, isDark);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RouterThemeProvider value={navTheme}>
        <Stack
          initialRouteName={onboarded ? "(tabs)" : "onboarding"}
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.ox,
            headerTitleStyle: { color: c.text, fontWeight: "600" },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: c.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
          <Stack.Screen name="plans/[id]" options={{ headerShown: true, title: "Plan" }} />
          <Stack.Screen
            name="plans/[id]/day/[day]"
            options={{ headerShown: true, title: "Plan day" }}
          />
        </Stack>
        {!onboarded && !pathname.startsWith("/onboarding") && (
          <Redirect href="/onboarding" />
        )}
      </RouterThemeProvider>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: LIGHT.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
