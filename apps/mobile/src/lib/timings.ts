import { useQuery } from "convex/react";
import { api } from "@openscripture/backend/convex/_generated/api";
import { CLIENT_KEY } from "@/lib/convex";

export type ChapterTiming = {
  url: string;
  start: number;
  end: number;
  verses: number[];
};

export type BookTimings = { chapters: Record<string, ChapterTiming> };

/** Timings for a book, loaded once when the KJV reader enters it. */
export function useBookTimings(
  abbrev: string,
  enabled: boolean
): BookTimings | null | undefined {
  return useQuery(
    api.timings.forBook,
    enabled && abbrev ? { book: abbrev, clientKey: CLIENT_KEY } : "skip"
  );
}

/** Timing for one chapter, or null when that chapter has not been aligned. */
export function getChapterTiming(
  timings: BookTimings | null | undefined,
  chapter: number
): ChapterTiming | null {
  const timing = timings?.chapters[String(chapter)];
  return timing && timing.verses.length > 0 ? timing : null;
}
