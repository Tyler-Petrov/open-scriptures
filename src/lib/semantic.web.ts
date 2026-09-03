// Semantic search needs the native ONNX runtime; unavailable in the web preview.

export type SemanticHit = {
  verseKey: string;
  ref: string;
  text: string;
  score: number;
};

export function semanticAvailable(): boolean {
  return false;
}

export async function semanticSearch(): Promise<SemanticHit[]> {
  return [];
}
