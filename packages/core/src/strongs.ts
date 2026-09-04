/** Display spans are reconstructed from the selected translation's text. */
export type WordSpan = [string, string | 0] | [string, string | 0, number];

export type StrongsEntry = {
  o: string;
  t: string;
  p: string;
  d: string;
  k: string; // Historical KJV usage, regardless of the reader's translation.
  r: string;
  u: string;
  pos: string;
  l: "Hebrew" | "Greek" | "Aramaic";
};

export type WordLink = { start: number; end: number; code: string | null; supplied: boolean };
export type VerseLinks = { fingerprint: string; links: WordLink[] };

/** FNV-1a 64 over UTF-16 code units. Detects accidental edition/text changes;
 * this is not an authentication mechanism. Offsets also use UTF-16 units. */
export function textFingerprint(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n);
  }
  return `${text.length}:${hash.toString(16)}`;
}

/** Never replace Scripture wording with alignment-source text. */
export function linkedSpans(text: string, alignment: VerseLinks | null | undefined): WordSpan[] | null {
  if (!alignment || textFingerprint(text) !== alignment.fingerprint) return null;
  const spans: WordSpan[] = [];
  let offset = 0;
  for (const link of alignment.links) {
    if (!Number.isInteger(link.start) || !Number.isInteger(link.end) ||
        link.start < offset || link.end <= link.start || link.end > text.length) return null;
    if (link.start > offset) spans.push([text.slice(offset, link.start), 0]);
    spans.push([text.slice(link.start, link.end), link.code ?? 0, link.supplied ? 1 : 0]);
    offset = link.end;
  }
  if (offset < text.length) spans.push([text.slice(offset), 0]);
  return spans.length ? spans : null;
}
