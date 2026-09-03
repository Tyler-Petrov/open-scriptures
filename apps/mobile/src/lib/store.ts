import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function useStored<T>(key: string, fallback: T): T {
  // Capture the first fallback; callers pass constants.
  const [initialFallback] = useState(fallback);
  const fallbackRef = useRef(initialFallback);
  const [value, setValue] = useState<T>(initialFallback);

  useEffect(() => {
    let alive = true;
    load(key, fallbackRef.current).then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load(key, fallbackRef.current).then((v) => {
        if (alive) setValue(v);
      });
      return () => {
        alive = false;
      };
    }, [key])
  );

  return value;
}
