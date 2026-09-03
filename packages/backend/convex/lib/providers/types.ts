import { ConvexError } from "convex/values";

export type ProviderChapter = {
  verses: string[];
  /** Unnumbered text before verse 1 (e.g. a Psalm superscription). */
  intro?: string;
  copyright?: string;
  fumsId?: string;
};

export type ProviderHit = { verseKey: string; ref: string; text: string };

export type UpstreamCode = "rate_limited" | "upstream_error" | "bad_response";

export function upstream(code: UpstreamCode, message: string): ConvexError<{ code: UpstreamCode; message: string }> {
  return new ConvexError({ code, message });
}

export function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
