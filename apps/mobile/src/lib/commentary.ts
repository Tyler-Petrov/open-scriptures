import { useQuery } from "convex/react";
import { api } from "@openscripture/backend/convex/_generated/api";
import { CLIENT_KEY } from "@/lib/convex";

export type CommentaryHit = {
  writerId: string;
  writer: string;
  ref: string;
  from: number;
  to: number;
  text: string;
};

/** Commentary for one verse, streamed from Convex. */
export function useCommentaryFor(
  abbrev: string,
  chapter: number,
  verse: number
): CommentaryHit[] | undefined {
  const valid =
    !!abbrev && Number.isInteger(chapter) && chapter >= 1 && Number.isInteger(verse) && verse >= 1;
  return useQuery(
    api.commentary.forVerse,
    valid ? { book: abbrev, chapter, verse, clientKey: CLIENT_KEY } : "skip"
  );
}
