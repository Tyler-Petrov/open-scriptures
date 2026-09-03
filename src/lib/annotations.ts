import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type HighlightColor =
  | "yellow"
  | "green"
  | "blue"
  | "pink"
  | "purple";

export type ReadingPosition = { book: string; chapter: number };

export type Highlight = { color: HighlightColor; note?: string };
export type Highlights = Record<string, Highlight>;

const K_HIGHLIGHTS = "bible.highlights";
const K_BOOKMARKS = "bible.bookmarks";
const K_NOTES = "bible.notes";
const K_POSITION = "bible.position";

const DEFAULT_POSITION: ReadingPosition = { book: "Gen", chapter: 1 };

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage write failures are non-fatal for the UI
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAnnotations(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // never let a listener crash persistence flows
    }
  }
}

export function parseVerseKey(verseKey: string): {
  abbrev: string;
  chapter: number;
  verse: number;
} {
  const [abbrev, chapter, verse] = verseKey.split(".");
  return {
    abbrev,
    chapter: Number(chapter),
    verse: Number(verse),
  };
}

function normalizeHighlights(raw: Record<string, unknown>): Highlights {
  const out: Highlights = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[key] = { color: value as HighlightColor }; // legacy string form
    } else if (value && typeof value === "object" && "color" in value) {
      out[key] = value as Highlight;
    }
  }
  return out;
}

export async function getHighlights(): Promise<Highlights> {
  return normalizeHighlights(await read<Record<string, unknown>>(K_HIGHLIGHTS, {}));
}

/** Set or change the color; null removes the highlight (and its note). */
export async function setHighlight(
  verseKey: string,
  color: HighlightColor | null
): Promise<void> {
  const all = await getHighlights();
  if (color == null) delete all[verseKey];
  else all[verseKey] = { ...all[verseKey], color };
  await write(K_HIGHLIGHTS, all);
  emit();
}

/** Attach a note to a highlight; creates a yellow highlight if none exists. */
export async function setHighlightNote(
  verseKey: string,
  note: string | null
): Promise<void> {
  const all = await getHighlights();
  const trimmed = (note ?? "").trim();
  const cur = all[verseKey] ?? { color: "yellow" as HighlightColor };
  if (trimmed) cur.note = trimmed;
  else delete cur.note;
  all[verseKey] = cur;
  await write(K_HIGHLIGHTS, all);
  emit();
}

export async function getBookmarks(): Promise<string[]> {
  return read<string[]>(K_BOOKMARKS, []);
}

export async function toggleBookmark(verseKey: string): Promise<string[]> {
  const list = await getBookmarks();
  const next = list.includes(verseKey)
    ? list.filter((k) => k !== verseKey)
    : [...list, verseKey];
  await write(K_BOOKMARKS, next);
  emit();
  return next;
}

export async function getPosition(): Promise<ReadingPosition> {
  const pos = await read<ReadingPosition | null>(K_POSITION, null);
  if (!pos || !pos.book || !pos.chapter) return DEFAULT_POSITION;
  return { book: pos.book, chapter: pos.chapter };
}

export async function setPosition(book: string, chapter: number): Promise<void> {
  await write(K_POSITION, { book, chapter } satisfies ReadingPosition);
  emit();
}

/** Persist position and route the reader straight to a verse. */
export async function goToVerse(verseKey: string): Promise<void> {
  const { abbrev, chapter, verse } = parseVerseKey(verseKey);
  await setPosition(abbrev, chapter);
  router.push(`/(tabs)/read?book=${abbrev}&ch=${chapter}&v=${verse}`);
}

/**
 * One-time merge into the single Highlights library: legacy string highlights
 * become objects, bookmarks become yellow highlights, and standalone notes
 * attach to their verse's highlight (creating a yellow one when needed).
 */
export async function migrateLibrary(): Promise<void> {
  const raw = await read<Record<string, unknown>>(K_HIGHLIGHTS, {});
  const all = normalizeHighlights(raw);
  let changed = Object.values(raw).some((v) => typeof v === "string");
  const bookmarks = await read<string[]>(K_BOOKMARKS, []);
  for (const key of bookmarks) {
    if (!all[key]) {
      all[key] = { color: "yellow" };
      changed = true;
    }
  }
  const notes = await read<Record<string, string>>(K_NOTES, {});
  for (const [key, text] of Object.entries(notes)) {
    const cur = all[key] ?? { color: "yellow" as HighlightColor };
    if (!cur.note) cur.note = text;
    all[key] = cur;
    changed = true;
  }
  if (changed || bookmarks.length > 0) {
    await write(K_HIGHLIGHTS, all);
    await write(K_BOOKMARKS, []);
    await write(K_NOTES, {});
    emit();
  }
}

export const HIGHLIGHT_TINTS: Record<HighlightColor, string> = {
  yellow: "#E2B33C",
  green: "#7FB069",
  blue: "#5B8DB8",
  pink: "#C97BA0",
  purple: "#9B8AC4",
};
