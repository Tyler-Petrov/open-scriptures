import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { load, save } from "@/lib/store";

export type ThemeMode = "system" | "light" | "dark";

export type Settings = {
  theme: ThemeMode;
  fontSize: number;
  onboarded: boolean;
};

export const SETTINGS_KEY = "bible.settings";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  fontSize: 18,
  onboarded: false,
};

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 28;

export const THEME_ORDER: ThemeMode[] = ["system", "light", "dark"];

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    load<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS).then((stored) => {
      if (!alive) return;
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void save(SETTINGS_KEY, settings);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ settings, ready, update }),
    [settings, ready, update]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside a SettingsProvider");
  }
  return ctx;
}
