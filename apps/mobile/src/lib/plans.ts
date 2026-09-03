import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

declare const require: (path: string) => unknown;

export type PlanAccent = "#B45454" | "#C9A24B" | "#5B8DB8" | "#7FB069";

export type PlanPassage = {
  book: string;
  from: number;
  to?: number;
};

export type PlanDay = {
  day: number;
  label: string;
  passages: PlanPassage[];
  devotional?: string;
};

export type Plan = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  accent: PlanAccent;
  days: PlanDay[];
};

// Lazy require map — each JSON bundle is parsed on first access.
const LOADERS: Record<string, () => unknown> = {
  "psalms-7": () => require("../assets/plans/psalms-7.json"),
  "gospels-21": () => require("../assets/plans/gospels-21.json"),
  "proverbs-5": () => require("../assets/plans/proverbs-5.json"),
  "yearly-canonical": () => require("../assets/plans/yearly-canonical.json"),
  "yearly-blended": () => require("../assets/plans/yearly-blended.json"),
};

const PLAN_IDS = Object.keys(LOADERS);

const cache = new Map<string, Plan>();

export function getPlan(id: string): Plan | undefined {
  if (cache.has(id)) return cache.get(id);
  const loader = LOADERS[id];
  if (!loader) return undefined;
  const plan = loader() as unknown as Plan;
  cache.set(id, plan);
  return plan;
}

export const PLANS: Plan[] = PLAN_IDS.map((id) => getPlan(id) as Plan);

// ---------------------------------------------------------------------------
// Reading progress — AsyncStorage key `openscripture.planProgress`
// Shape: { [planId]: { completed: number[] } }
// ---------------------------------------------------------------------------

export type PlanProgress = Record<string, { completed: number[] }>;

const PROGRESS_KEY = "openscripture.planProgress";

export async function loadPlanProgress(): Promise<PlanProgress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as PlanProgress;
    }
    return {};
  } catch {
    return {};
  }
}

async function writePlanProgress(progress: PlanProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage write failures are non-fatal for reading plans.
  }
}

export async function markDayComplete(planId: string, day: number): Promise<PlanProgress> {
  const progress = await loadPlanProgress();
  const entry = progress[planId] ?? { completed: [] };
  if (!entry.completed.includes(day)) {
    entry.completed = [...entry.completed, day].sort((a, b) => a - b);
    progress[planId] = entry;
    await writePlanProgress(progress);
  }
  return progress;
}

export async function resetPlanProgress(planId: string): Promise<PlanProgress> {
  const progress = await loadPlanProgress();
  progress[planId] = { completed: [] };
  await writePlanProgress(progress);
  return progress;
}

export function completedDays(progress: PlanProgress, planId: string): number[] {
  return progress[planId]?.completed ?? [];
}

/** First day not yet completed, or null if the plan is fully done. */
export function firstIncompleteDay(plan: Plan, progress: PlanProgress): number | null {
  const done = new Set(completedDays(progress, plan.id));
  for (const d of plan.days) {
    if (!done.has(d.day)) return d.day;
  }
  return null;
}

/** Hook: plan progress that re-reads every time its screen regains focus. */
export function usePlanProgress(): PlanProgress {
  const [progress, setProgress] = useState<PlanProgress>({});
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadPlanProgress().then((p) => {
        if (alive) setProgress(p);
      });
      return () => {
        alive = false;
      };
    }, [])
  );
  return progress;
}
