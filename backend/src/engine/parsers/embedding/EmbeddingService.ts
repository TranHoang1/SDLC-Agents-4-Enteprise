export class EmbeddingService {
  private static instance: EmbeddingService;

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Generates a deterministic pseudo-embedding for the given text using a sin-hash approach.
   * This is a fallback implementation to avoid native dependencies on Windows.
   * Vector size: 384
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    const vectorSize = 384;
    const vector = new Array(vectorSize).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    const seed = Math.abs(hash);
    for (let i = 0; i < vectorSize; i++) {
      const x = Math.sin(seed + i * 12.9898) * 43758.5453;
      vector[i] = x - Math.floor(x);
    }
    // Normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
    return vector;
  }

  /**
   * Calculates cosine similarity between two vectors.
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vector dimension mismatch');
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
