/**
 * SA4E-88 — Helper functions for PegaIndexerTool.
 * File discovery, JSON parsing, node/edge building utilities.
 * Separated from tool handler to keep each file under 200 lines (SRP).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_EXTRACTORS, type ExtractedEdge } from './scripts/edge-extractors.js';

/**
 * Discover .pega.json files recursively in a directory.
 * @param dir - Root directory to scan
 * @returns Array of absolute file paths
 */
export async function discoverRuleFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await discoverRuleFiles(fullPath);
      files.push(...nested);
    } else if (entry.name.endsWith('.pega.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Read file content safely — returns null on I/O error.
 * @param filePath - Absolute path to the file
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Derive a canonical node ID from a rule's pxObjClass + className + name. */
export function buildNodeId(json: Record<string, unknown>): string {
  const cls = (json.pyClassName as string) || '@baseclass';
  const name = (json.pyRuleName as string)
    || (json.pyActivityName as string)
    || (json.pyFlowName as string)
    || (json.pyModelName as string)
    || '';
  const ruleType = ((json.pxObjClass as string) || '').replace('Rule-Obj-', '');
  return `${ruleType}::${cls}::${name}`;
}

/** Map pxObjClass to a graph node type label. */
export function ruleClassToNodeType(pxObjClass: string): string {
  if (pxObjClass.includes('Activity')) return 'FUNCTION';
  if (pxObjClass.includes('Flow')) return 'FUNCTION';
  if (pxObjClass.includes('Class')) return 'CLASS';
  if (pxObjClass.includes('Property')) return 'PROPERTY';
  if (pxObjClass.includes('Model')) return 'FUNCTION';
  if (pxObjClass.includes('Decision')) return 'FUNCTION';
  return 'DOCUMENT';
}

/** Extract a short display label from a rule JSON (max 50 chars). */
export function buildNodeLabel(json: Record<string, unknown>): string {
  const name = (json.pyRuleName as string)
    || (json.pyActivityName as string)
    || (json.pyFlowName as string)
    || (json.pyModelName as string)
    || 'Unknown';
  return name.substring(0, 50);
}

/**
 * Extract edges from a single rule using all registered extractors.
 * Deduplicates edges within the same rule (Strategy pattern via ALL_EXTRACTORS).
 */
export function extractEdgesFromRule(json: Record<string, unknown>): ExtractedEdge[] {
  const pxObjClass = (json.pxObjClass as string) || '';
  if (!pxObjClass) return [];
  const edges: ExtractedEdge[] = [];
  const seen = new Set<string>();
  for (const extractor of ALL_EXTRACTORS) {
    if (!extractor.supports(pxObjClass)) continue;
    for (const edge of extractor.extract(json)) {
      const key = `${edge.sourceId}-${edge.targetId}-${edge.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
  }
  return edges;
}
