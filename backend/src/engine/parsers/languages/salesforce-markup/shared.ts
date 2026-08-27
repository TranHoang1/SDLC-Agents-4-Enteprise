/**
 * SA4E-223 — Shared markup extraction for Visualforce / Aura (regex/generic).
 * Extracts a single top-level symbol (named from the file path, always present)
 * plus up to one best-effort relationship per configured root attribute.
 * No XML parser is used — bounded linear regex only (ReDoS-safe, XXE-safe).
 *
 * SECURITY (Pentest F-1 / ReDoS): the previous pattern used an unbounded greedy
 * `[^>]*` which, combined with the `\b` anchor and a malformed root tag lacking a
 * closing `>` (e.g. a 430–512 KB file of repeated `<apex:page `), caused
 * catastrophic backtracking (O(n^2)) and a local CPU hang of 30–45 s.
 * The fix below keeps matching strictly linear:
 *   1. The attribute region is length-bounded (`[^>]{0,MAX_ATTR}`), so the engine
 *      can never expand the scan past a fixed window — backtracking is bounded.
 *   2. An early guard returns immediately when no `>` exists in the source, so a
 *      malformed file with no closing bracket never even enters the matcher.
 *   3. Only a bounded leading prefix of the source (`MAX_SCAN`) is scanned, since a
 *      root opening tag always appears near the top of a real document.
 */
import type { ExtractedSymbol, ExtractedRelationship, RelationshipKind } from '../../types.js';

export interface MarkupParseOptions {
  rootTags: string[];                       // e.g. ['apex:page','apex:component'] | ['aura:component', ...]
  signaturePrefix: string;                 // 'VisualforcePage' | 'AuraComponent' ...
  modifiers: string[];                     // ['visualforce','page'] ...
  relationshipAttrs?: { attr: string; kind: RelationshipKind }[];
}

/** Max chars scanned for a root opening tag (defense-in-depth vs ReDoS on huge malformed files). */
const MAX_SCAN = 4096;
/** Upper bound on the attribute region of a root tag — caps backtracking blow-up. */
const MAX_ATTR = 2000;

// Length-bounded attribute region => the matcher is O(scan window), never O(n^2).
const ROOT_TAG_RE = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]{0,${MAX_ATTR}}>`);
const ATTR_RE = (attr: string): RegExp => new RegExp(`${attr}\\s*=\\s*["']([^"']{0,${MAX_ATTR}})["']`, 'i');

export function extractMarkupTopLevel(
  source: string, filePath: string, opts: MarkupParseOptions,
): { symbols: ExtractedSymbol[]; relationships: ExtractedRelationship[] } {
  const symbols: ExtractedSymbol[] = [];
  const relationships: ExtractedRelationship[] = [];

  try {
    // Early guard: without any `>` the root opening tag can never complete — skip scanning entirely.
    if (!source.includes('>')) return { symbols, relationships };

    const base = nameFromPath(filePath);
    const lineCount = source.split('\n').length;

    // Bound the haystack to the leading region; a real root tag is always near the top.
    const scanRegion = source.length > MAX_SCAN ? source.slice(0, MAX_SCAN) : source;
    const opening = scanRegion.match(ROOT_TAG_RE);
    if (!opening) return { symbols, relationships };

    const rootTag = opening[1].toLowerCase();
    if (!opts.rootTags.map(t => t.toLowerCase()).includes(rootTag)) {
      return { symbols, relationships };
    }

    symbols.push({
      name: base,
      kind: 'class',
      filePath,
      startLine: 1,
      endLine: lineCount,
      signature: `${opts.signaturePrefix}: ${base}`,
      modifiers: opts.modifiers,
      isExported: true,
    });

    if (opts.relationshipAttrs) {
      for (const { attr, kind } of opts.relationshipAttrs) {
        const m = opening[0].match(ATTR_RE(attr));
        if (m && m[1].trim()) {
          // Apex multi-controller / extensions may be comma-separated
          for (const target of m[1].split(',')) {
            const t = target.trim();
            if (t) relationships.push({ sourceSymbol: base, targetSymbol: t, kind, filePath, line: 1 });
          }
        }
      }
    }
  } catch {
    // degrade gracefully — never throw on malformed markup
  }

  return { symbols, relationships };
}

function nameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? normalized;
  return base.replace(/\.\w+$/, '');
}
