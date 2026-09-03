import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme } from "expo-router";
import { useSettings } from "@/lib/settings";

export type Palette = {
  bg: string;
  card: string;
  line: string;
  text: string;
  subtext: string;
  gold: string;
  ox: string;
  blue: string;
};

export const LIGHT: Palette = {
  bg: "#F6F1E6",
  card: "#FBF8F0",
  line: "#E2DBC9",
  text: "#3E3226",
  subtext: "#8B8272",
  gold: "#C9A24B",
  ox: "#B45454",
  blue: "#47779F",
};

export const DARK: Palette = {
  bg: "#141A24",
  card: "#1B2130",
  line: "rgba(255,255,255,0.10)",
  text: "#EFE8D8",
  subtext: "#98A0B3",
  gold: "#C9A24B",
  ox: "#B45454",
  blue: "#73A9D6",
};

export const GOLD_SOFT = "rgba(201,162,75,0.16)";
export const OX_SOFT = "rgba(180,84,84,0.14)";

type ThemeContextValue = { c: Palette; isDark: boolean };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const scheme = useColorScheme();
  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" && scheme === "dark");
  const value = useMemo<ThemeContextValue>(
    () => ({ c: isDark ? DARK : LIGHT, isDark }),
    [isDark]
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return ctx;
}

export function toNavTheme(c: Palette, isDark: boolean) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    dark: isDark,
    colors: {
      ...base.colors,
      primary: c.ox,
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.line,
      notification: c.ox,
    },
    fonts: base.fonts,
  };
}
