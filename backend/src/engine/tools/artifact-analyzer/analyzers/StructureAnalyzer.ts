import type { ArtifactAnalyzer, ArtifactAnalysis, ArtifactType } from '../types.js';

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function looksLikeXml(content: string): boolean {
  return /^\s*<[A-Za-z_][A-Za-z0-9_.:-]*[\s>]/m.test(content.trim());
}

function looksLikeYaml(content: string): boolean {
  return /^---\s*$|^[a-zA-Z_][a-zA-Z0-9_]*\s*:\s/m.test(content.trim());
}

function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array[]';
    const elementTypes = new Set(value.map(v => getJsonType(v)));
    return `array<${[...elementTypes].join('|')}>`;
  }
  return typeof value;
}

function analyzeJsonSchema(parsed: unknown): {
  topLevelType: string;
  topLevelKeyCount: number;
  schemaTree: string;
} {
  const schemaLines: string[] = [];

  if (Array.isArray(parsed)) {
    schemaLines.push('Array');
    if (parsed.length > 0) {
      const elementType = getJsonType(parsed[0]);
      schemaLines.push(`  └── [0]: ${elementType}`);
      if (parsed.length > 1) {
        schemaLines.push(`  └── ... (${parsed.length} items total)`);
      } else {
        schemaLines.push(`  └── (${parsed.length} item)`);
      }
    }
    return {
      topLevelType: 'array',
      topLevelKeyCount: parsed.length,
      schemaTree: schemaLines.join('\n'),
    };
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj);
    schemaLines.push(`Object (${keys.length} keys)`);

    for (const key of keys.slice(0, 20)) {
      const value = obj[key];
      const type = getJsonType(value);
      const sample = typeof value === 'string'
        ? `"${value.slice(0, 80)}"`
        : typeof value === 'object' && value !== null
          ? Array.isArray(value)
            ? `[${value.length} items]`
            : `{${Object.keys(value as Record<string, unknown>).length} keys}`
          : String(value);
      schemaLines.push(`  ├── ${key}: ${type} = ${sample}`);
    }
    if (keys.length > 20) {
      schemaLines.push(`  └── ... (${keys.length - 20} more keys)`);
    }

    return {
      topLevelType: 'object',
      topLevelKeyCount: keys.length,
      schemaTree: schemaLines.join('\n'),
    };
  }

  return {
    topLevelType: typeof parsed,
    topLevelKeyCount: 0,
    schemaTree: `Scalar: ${String(parsed).slice(0, 100)}`,
  };
}

function analyzeYamlStructure(content: string): string {
  const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
  const topLevelKeys: string[] = [];
  const schemaLines: string[] = ['YAML Document'];

  for (const line of lines) {
    const match = line.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*:/);
    if (match) {
      topLevelKeys.push(match[0].replace(':', '').trim());
    }
  }

  for (const key of topLevelKeys.slice(0, 15)) {
    schemaLines.push(`  ├── ${key}`);
  }
  if (topLevelKeys.length > 15) {
    schemaLines.push(`  └── ... (${topLevelKeys.length - 15} more keys)`);
  }

  schemaLines.push('');
  schemaLines.push(`Top-level keys: ${topLevelKeys.length}`);
  return schemaLines.join('\n');
}

export class StructureAnalyzer implements ArtifactAnalyzer {
  type: ArtifactType = 'structured_data';

  canAnalyze(content: string): boolean {
    if (!content || content.trim().length === 0) return false;
    return looksLikeJson(content) || looksLikeXml(content) || looksLikeYaml(content);
  }

  analyze(content: string, _options?: Record<string, unknown>): ArtifactAnalysis {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const charCount = content.length;

    // JSON analysis
    if (looksLikeJson(content)) {
      const trimmed = content.trim();
      const parsed = JSON.parse(trimmed);
      const { topLevelType, topLevelKeyCount, schemaTree } = analyzeJsonSchema(parsed);

      return {
        type: 'structured_data',
        summary: `JSON document — ${lineCount} lines, ${charCount} chars, ${topLevelType} with ${topLevelKeyCount} top-level ${topLevelType === 'array' ? 'items' : 'keys'}`,
        promptContext: [
          `## JSON Structure Analysis`,
          ``,
          `### Schema Tree`,
          schemaTree,
          ``,
          `### Raw Content (${charCount} chars)`,
          '```json',
          trimmed.slice(0, 5000),
          trimmed.length > 5000 ? '\n... (truncated)' : '',
          '```',
        ].join('\n'),
        details: {
          lines: lineCount,
          chars: charCount,
          format: 'json',
          topLevelType,
          topLevelKeyCount,
          schemaTree,
        },
        detectedBy: 'content-heuristic',
      };
    }

    // XML analysis
    if (looksLikeXml(content)) {
      const tagMatches = content.match(/<\/?[A-Za-z_][A-Za-z0-9_.:-]*(?:\s[^>]*)?>/g);
      const uniqueTags = [...new Set(tagMatches?.map(t => t.replace(/<\/?/, '<').replace(/\s.*?>/, '>').replace('/', '')) ?? [])];

      return {
        type: 'structured_data',
        summary: `XML document — ${lineCount} lines, ${charCount} chars, ${uniqueTags.length} unique tags`,
        promptContext: [
          `## XML Document Analysis`,
          ``,
          `- Lines: ${lineCount}`,
          `- Characters: ${charCount}`,
          `- Unique tags: ${uniqueTags.length}`,
          uniqueTags.length > 0 ? `- Tags: ${uniqueTags.join(', ')}` : '',
          ``,
          `> For deeper processing, use the \`get_edit_context\` tool.`,
        ].filter(Boolean).join('\n'),
        details: {
          lines: lineCount,
          chars: charCount,
          format: 'xml',
          uniqueTags,
          tagCount: tagMatches?.length ?? 0,
        },
        detectedBy: 'content-heuristic',
      };
    }

    // YAML analysis
    const yamlStructure = analyzeYamlStructure(content);
    return {
      type: 'structured_data',
      summary: `YAML document — ${lineCount} lines, ${charCount} chars`,
      promptContext: [
        `## YAML Document Analysis`,
        ``,
        yamlStructure,
        ``,
        `> For deeper processing, use the \`get_edit_context\` tool.`,
      ].join('\n'),
      details: {
        lines: lineCount,
        chars: charCount,
        format: 'yaml',
        structure: yamlStructure,
      },
      detectedBy: 'content-heuristic',
    };
  }
}
