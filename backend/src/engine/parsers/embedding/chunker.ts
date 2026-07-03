/**
 * KSA-169: Chunker — Split text into overlapping chunks for embedding.
 * Uses token-based splitting with configurable overlap.
 */

export interface Chunk {
  text: string;
  index: number;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

export class Chunker {
  private maxTokens: number;
  private overlap: number;

  constructor(maxTokens: number = 512, overlap: number = 128) {
    this.maxTokens = maxTokens;
    this.overlap = overlap;
  }

  /** Split text into chunks. Returns single chunk if <= maxTokens. */
  chunk(text: string): Chunk[] {
    const words = text.split(/\s+/).filter(Boolean);
    const totalTokens = words.length;

    if (totalTokens <= this.maxTokens) {
      return [{
        text,
        index: 0,
        tokenCount: totalTokens,
        startOffset: 0,
        endOffset: text.length,
      }];
    }

    const chunks: Chunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < words.length) {
      const end = Math.min(start + this.maxTokens, words.length);
      const chunkWords = words.slice(start, end);
      const chunkText = chunkWords.join(' ');

      chunks.push({
        text: chunkText,
        index: chunkIndex,
        tokenCount: chunkWords.length,
        startOffset: start,
        endOffset: end,
      });

      chunkIndex++;
      start += this.maxTokens - this.overlap;

      if (start >= words.length) break;
    }

    return chunks;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }

  getOverlap(): number {
    return this.overlap;
  }
}
