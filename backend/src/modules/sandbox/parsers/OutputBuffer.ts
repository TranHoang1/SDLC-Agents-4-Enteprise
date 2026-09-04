/**
 * SA4E-6 — OutputBuffer: stream capture with a hard byte cap (BR-10).
 * Keeps the TAIL (most recent bytes) when over the limit so the latest output
 * survives truncation (FSD TC-07: "last 1MB kept").
 */

export class OutputBuffer {
  private chunks: string[] = [];
  private total = 0;
  private overflowed = false;

  constructor(private readonly maxBytes: number) {}

  append(text: string): void {
    const len = Buffer.byteLength(text, 'utf-8');
    this.chunks.push(text);
    this.total += len;
    while (this.total > this.maxBytes && this.chunks.length > 0) {
      const first = this.chunks[0];
      const firstLen = Buffer.byteLength(first, 'utf-8');
      const cut = this.total - this.maxBytes;
      if (firstLen > cut) {
        this.chunks[0] = first.slice(cut);
        this.total -= cut;
        this.overflowed = true;
        break;
      }
      this.chunks.shift();
      this.total -= firstLen;
      this.overflowed = true;
    }
  }

  get value(): string {
    return this.chunks.join('');
  }

  get bytes(): number {
    return this.total;
  }

  get truncated(): boolean {
    return this.overflowed;
  }
}

/**
 * Heuristic binary-output detection (FSD TC-17). True when the text contains a
 * NUL byte or more than ~5% non-printable control characters in its sample.
 */
export function detectBinary(text: string): boolean {
  if (text.indexOf(String.fromCharCode(0)) !== -1) return true;
  let nonPrintable = 0;
  let total = 0;
  const sample = text.slice(0, 8192);
  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    total++;
    if (code < 9 || (code > 13 && code < 32)) nonPrintable++;
  }
  return total > 0 && nonPrintable / total > 0.05;
}
