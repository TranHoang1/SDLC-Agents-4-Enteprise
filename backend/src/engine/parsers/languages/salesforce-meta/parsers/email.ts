import type { ExtractedSymbol, ExtractedRelationship } from '../../../types.js';
import { nameFromPath } from '../helpers.js';

export function parseEmail(source: string, filePath: string, symbols: ExtractedSymbol[], _rel: ExtractedRelationship[]): void {
  const name = nameFromPath(filePath);
  const lineCount = source.split('\n').length;
  symbols.push({ name, kind: 'class', filePath, startLine: 1, endLine: lineCount, signature: `EmailTemplate: ${name}`, modifiers: ['email'], isExported: true });
}
