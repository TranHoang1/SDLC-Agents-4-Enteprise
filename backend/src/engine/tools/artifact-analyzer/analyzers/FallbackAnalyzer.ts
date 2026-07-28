import * as crypto from 'crypto';
import type { ArtifactAnalyzer, ArtifactAnalysis, ArtifactType } from '../types.js';

/**
 * FallbackAnalyzer — always matches as the last resort.
 * Provides basic metadata for any content that doesn't match
 * Pega, code, or structured data analyzers.
 */
export class FallbackAnalyzer implements ArtifactAnalyzer {
  type: ArtifactType = 'unknown';

  canAnalyze(_content?: string): boolean {
    return true; // Always matches as fallback
  }

  analyze(content: string, _options?: Record<string, unknown>): ArtifactAnalysis {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const charCount = content.length;
    const preview = content.slice(0, 100).replace(/[\r\n]/g, ' ');

    // Content hash for dedup
    const contentHash = crypto
      .createHash('md5')
      .update(content, 'utf8')
      .digest('hex');

    // Detect if content looks like binary vs text
    const isLikelyBinary = detectBinary(content);
    const hasNewlines = content.includes('\n');
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    return {
      type: 'unknown',
      summary: `Unknown artifact — ${lineCount} lines, ${charCount} chars, ${wordCount} words`,
      promptContext: [
        `## Unknown Artifact`,
        ``,
        `Basic metadata:`,
        `- Lines: ${lineCount}`,
        `- Characters: ${charCount}`,
        `- Words: ${wordCount}`,
        `- MD5: ${contentHash}`,
        `- Binary content: ${isLikelyBinary}`,
        `- Has newlines: ${hasNewlines}`,
        ``,
        `### Preview (first 100 chars)`,
        preview,
        ``,
        `> This content did not match any specific analyzer (Pega rule, code, or structured data).`,
        `> For context-aware analysis, try the \`get_edit_context\` or \`get_ai_context\` tool.`,
      ].join('\n'),
      details: {
        lines: lineCount,
        chars: charCount,
        words: wordCount,
        md5: contentHash,
        likelyBinary: isLikelyBinary,
        preview,
      },
      detectedBy: 'fallback',
    };
  }
}

function detectBinary(content: string): boolean {
  // Check for non-printable characters (excluding common whitespace)
  let binaryBytes = 0;
  for (let i = 0; i < Math.min(content.length, 1000); i++) {
    const code = content.charCodeAt(i);
    // Allow common whitespace: tab(9), newline(10), carriage return(13)
    if (code < 8 || (code > 13 && code < 32) || code === 127) {
      binaryBytes++;
    }
  }
  // If more than 10% of the first 1000 bytes are control characters, likely binary
  return binaryBytes > Math.min(content.length, 1000) * 0.1;
}
