/** Display spans are reconstructed from the selected translation's text. */
export type WordSpan = [string, string[] | 0, number?];

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

/** IDs identify occurrences in the source verse, not dictionary entries.
 * Two original words may have the same Strong's number but different IDs. */
export type SourceWord = { id: string; codes: string[]; text?: string; morphology?: string };
export type WordLink = {
  start: number;
  end: number;
  supplied: boolean;
  sourceWordIds?: string[];
} & ({ codes: string[]; code?: never } | { code: string | null; codes?: never });
export type VerseLinks = { fingerprint: string; links: WordLink[]; sourceWords?: SourceWord[] };
export const STRONGS_CODE_PATTERN = /^[GH][1-9][0-9]{0,4}[a-zA-Z]?$/;

/** FNV-1a 64 over UTF-16 code units. Detects accidental edition/text changes;
 * this is not an authentication mechanism. Offsets also use UTF-16 units. */
export function textFingerprint(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n);
  }
  return `${text.length}:${hash.toString(16)}`;
}

/** Never replace Scripture wording with alignment-source text. Overlapping and
 * discontinuous source links become disjoint display spans containing all codes. */
export function linkedSpans(text: string, alignment: VerseLinks | null | undefined): WordSpan[] | null {
  if (!alignment || textFingerprint(text) !== alignment.fingerprint) return null;
  const words = new Map((alignment.sourceWords ?? []).map(word => [word.id, word]));
  if (words.size !== (alignment.sourceWords?.length ?? 0)) return null;
  for (const word of words.values()) {
    if (!word.id || !word.codes.length || word.codes.some(code => !STRONGS_CODE_PATTERN.test(code))) return null;
  }
  const boundaries = new Set([0, text.length]);
  const links = [];
  for (const link of alignment.links) {
    if (!Number.isInteger(link.start) || !Number.isInteger(link.end) ||
        link.start < 0 || link.end <= link.start || link.end > text.length) return null;
    const codes = [...new Set(link.codes ?? (link.code ? [link.code] : []))];
    if (codes.some(code => !STRONGS_CODE_PATTERN.test(code))) return null;
    if (link.sourceWordIds) {
      if (!link.sourceWordIds.length || link.sourceWordIds.some(id => !words.has(id))) return null;
      const sourceCodes = new Set(link.sourceWordIds.flatMap(id => words.get(id)!.codes));
      if (sourceCodes.size !== codes.length || codes.some(code => !sourceCodes.has(code))) return null;
    }
    links.push({ ...link, codes });
    boundaries.add(link.start);
    boundaries.add(link.end);
  }
  const offsets = [...boundaries].sort((a, b) => a - b);
  const spans: WordSpan[] = [];
  for (let i = 1; i < offsets.length; i++) {
    const start = offsets[i - 1];
    const end = offsets[i];
    const covering = links.filter(link => link.start <= start && link.end >= end);
    const codes = [...new Set(covering.flatMap(link => link.codes))];
    spans.push([text.slice(start, end), codes.length ? codes : 0, covering.some(link => link.supplied) ? 1 : 0]);
  }
  return spans.length ? spans : null;
}
