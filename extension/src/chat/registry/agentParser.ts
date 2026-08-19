/**
 * SA4E-85 — Agent YAML Frontmatter Parser (Task 3.2).
 * Parses .md files with YAML frontmatter into AgentMeta objects.
 * Lightweight YAML extraction. Invalid YAML → skip + log (BR-12).
 */

import * as path from 'path';
import type { AgentMeta } from '../types';

/**
 * Raw shape of YAML frontmatter fields in an agent .md file.
 * All fields optional — missing fields get safe defaults.
 */
interface RawAgentFrontmatter {
  id?: string;
  name?: string;
  description?: string;
  tools?: string[];
  mcpServers?: string[];
  autoApprove?: string[];
  /** SA4E-186: LLM model identifier for per-agent model routing */
  model?: string;
}

/**
 * Parse YAML frontmatter from raw file content into AgentMeta.
 * Falls back to filename-derived ID if frontmatter is missing or invalid.
 * @param content - Raw markdown file content (including --- delimiters)
 * @param filePath - Absolute path to the .md file (used for ID fallback)
 * @param logger - Optional log function for warnings on invalid YAML
 * @returns AgentMeta if parseable, null if file should be skipped
 */
export function parseAgentFile(
  content: string,
  filePath: string,
  logger?: (msg: string) => void,
): AgentMeta | null {
  try {
    const parsed = extractFrontmatter(content);
    if (!parsed) {
      logger?.(`[AgentRegistry] No frontmatter in ${filePath}, using defaults`);
      return buildMeta({}, filePath);
    }
    return buildMeta(parsed, filePath);
  } catch (err) {
    // BR-12: Invalid YAML → skip agent, log warning (never crash)
    const message = err instanceof Error ? err.message : String(err);
    logger?.(`[AgentRegistry] Invalid YAML in ${filePath}: ${message}`);
    return null;
  }
}

/**
 * Extract YAML frontmatter between --- delimiters.
 * Handles the standard --- delimited YAML block at file start.
 */
function extractFrontmatter(content: string): RawAgentFrontmatter | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) return null;

  const yamlBlock = trimmed.slice(3, endIndex).trim();
  if (!yamlBlock) return null;

  return parseSimpleYaml(yamlBlock);
}

/**
 * Minimal YAML parser for flat key-value and simple arrays.
 * Sufficient for agent frontmatter without external dependencies.
 */
function parseSimpleYaml(yaml: string): RawAgentFrontmatter {
  const result: Record<string, string | string[]> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmedLine = line.trimEnd();

    // Array item: "  - value"
    if (trimmedLine.match(/^\s+-\s+/) && currentKey) {
      const value = trimmedLine.replace(/^\s+-\s+/, '').trim();
      if (!currentArray) currentArray = [];
      currentArray.push(stripQuotes(value));
      continue;
    }

    // Flush previous array if switching to new key
    if (currentKey && currentArray) {
      result[currentKey] = currentArray;
      currentArray = null;
    }

    // Key-value pair: "key: value" or "key:" (array follows)
    const kvMatch = trimmedLine.match(/^(\w+)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const rawValue = kvMatch[2].trim();
      if (rawValue === '' || rawValue === '[]') {
        currentArray = rawValue === '[]' ? [] : null;
        if (rawValue === '[]') {
          result[currentKey] = [];
          currentKey = null;
        }
      } else {
        result[currentKey] = stripQuotes(rawValue);
        currentKey = null;
      }
    }
  }

  // Flush final pending array
  if (currentKey && currentArray) {
    result[currentKey] = currentArray;
  }

  return result as unknown as RawAgentFrontmatter;
}

/** Remove surrounding quotes from a YAML string value */
function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Build a complete AgentMeta from parsed frontmatter with safe defaults.
 * ID derives from filename if not specified in frontmatter.
 *
 * SA4E-186: tools field semantics:
 * - frontmatter has NO tools key → undefined (unrestricted, all tools allowed)
 * - frontmatter has `tools: []` → [] (text-only, no tools)
 * - frontmatter has `tools: [patterns...]` → patterns array
 */
function buildMeta(raw: RawAgentFrontmatter, filePath: string): AgentMeta {
  const filename = path.basename(filePath, '.md');
  return {
    id: raw.id ?? filename,
    name: raw.name ?? filename,
    description: raw.description ?? '',
    tools: 'tools' in raw ? (Array.isArray(raw.tools) ? raw.tools : []) : undefined,
    mcpServers: Array.isArray(raw.mcpServers) ? raw.mcpServers : [],
    autoApprove: Array.isArray(raw.autoApprove) ? raw.autoApprove : [],
    model: raw.model || undefined,
    filePath,
  };
}

/**
 * Derive agent ID from a file path (fallback when frontmatter has no id).
 * @param filePath - Absolute path to the agent .md file
 * @returns Filename without extension as ID
 */
export function deriveAgentId(filePath: string): string {
  return path.basename(filePath, '.md');
}
