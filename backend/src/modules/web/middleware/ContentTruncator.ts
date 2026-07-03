/**
 * Content size enforcement middleware.
 * Truncates responses exceeding configured maximum size.
 */

export interface TruncateResult {
  content: string;
  truncated: boolean;
  originalLength: number;
}

export class ContentTruncator {
  private maxBytes: number;

  constructor(maxKb: number) {
    this.maxBytes = maxKb * 1024;
  }

  truncate(content: string, customMax?: number): TruncateResult {
    const limit = customMax ?? this.maxBytes;
    const originalLength = content.length;
    if (content.length <= limit) {
      return { content, truncated: false, originalLength };
    }
    return {
      content: content.slice(0, limit),
      truncated: true,
      originalLength,
    };
  }
}
