// Minimal BERT-uncased WordPiece encoder (lowercase, strip accents), matching
// the tokenizer the verse embeddings were built with.

export function encodeWordPiece(
  text: string,
  vocab: Record<string, number>,
  maxLen: number
): number[] {
  const CLS = vocab["[CLS]"];
  const SEP = vocab["[SEP]"];
  const UNK = vocab["[UNK]"];
  const clean = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const words = clean.match(/[a-z0-9]+|[^\sa-z0-9]/g) ?? [];
  const ids: number[] = [CLS];
  for (const w of words) {
    if (ids.length >= maxLen - 1) break;
    if (w.length > 100) {
      ids.push(UNK);
      continue;
    }
    const sub: number[] = [];
    let start = 0;
    let ok = true;
    while (start < w.length) {
      let end = w.length;
      let cur = -1;
      while (start < end) {
        const piece = (start > 0 ? "##" : "") + w.slice(start, end);
        const id = vocab[piece];
        if (id !== undefined) {
          cur = id;
          break;
        }
        end--;
      }
      if (cur < 0) {
        ok = false;
        break;
      }
      sub.push(cur);
      start = end;
    }
    if (ok) {
      for (const id of sub) {
        if (ids.length >= maxLen - 1) break;
        ids.push(id);
      }
    } else {
      ids.push(UNK);
    }
  }
  ids.push(SEP);
  return ids;
}
