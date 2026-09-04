import type { ExtractedSymbol, ExtractedRelationship } from '../../types.js';
import { extractXmlValues, extractXmlBlocks, nameFromPath, isSecretElement } from '../helpers.js';

export function parseLabels(source: string, filePath: string, symbols: ExtractedSymbol[], _rel: ExtractedRelationship[]): void {
  const name = nameFromPath(filePath);
  const lineCount = source.split('\n').length;
  symbols.push({ name, kind: 'class', filePath, startLine: 1, endLine: lineCount, signature: `Labels: ${name}`, modifiers: ['labels'], isExported: true });
  // Optional: each <CustomLabel><fullName> becomes a property (skip secret names per F-03)
  const labels = extractXmlBlocks(source, 'CustomLabel');
  for (const block of labels) {
    const labelName = extractXmlValues(block, 'fullName')[0];
    if (labelName && !isSecretElement(labelName)) {
      symbols.push({ name: labelName, kind: 'property', filePath, startLine: 1, endLine: 1, signature: `Label: ${labelName}`, parentName: name, isExported: false });
    }
  }
}
