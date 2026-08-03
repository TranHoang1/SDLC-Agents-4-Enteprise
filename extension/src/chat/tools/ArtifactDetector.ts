/**
 * SA4E-85 — ArtifactDetector (Task 4.3).
 * Regex-based detection of artifact paths from shell output.
 * Detects test reports, coverage reports, and build artifacts.
 * Pure function module — no side effects.
 */

/** Supported artifact categories for display logic */
export type ArtifactType = 'test-report' | 'coverage' | 'build' | 'generic';

/** Detected artifact link for UI rendering */
export interface ArtifactLink {
  label: string;
  path: string;
  type: ArtifactType;
}

/** Internal detection pattern definition */
interface DetectionPattern {
  regex: RegExp;
  label: string;
  type: ArtifactType;
}

// Known report paths matched with high confidence
const KNOWN_REPORTS: DetectionPattern[] = [
  { regex: /serenity[\\/]index\.html/gi, label: 'View Serenity Report', type: 'test-report' },
  { regex: /allure-report[\\/]index\.html/gi, label: 'View Allure Report', type: 'test-report' },
  { regex: /coverage[\\/]index\.html/gi, label: 'Open Coverage', type: 'coverage' },
  { regex: /coverage[\\/]lcov-report[\\/]index\.html/gi, label: 'Open Coverage', type: 'coverage' },
  { regex: /mochawesome-report[\\/]mochawesome\.html/gi, label: 'View Mochawesome', type: 'test-report' },
  { regex: /jest-html-report[\\/]index\.html/gi, label: 'View Jest Report', type: 'test-report' },
];

// Generic artifact path pattern: build output directories
const GENERIC_ARTIFACT_REGEX =
  /(?:target|build|dist|out)[\\/][^\s]+\.(html|pdf|json|xml)/gi;

/** User-registered custom patterns */
const customPatterns: DetectionPattern[] = [];

/**
 * Register an additional detection pattern at runtime.
 * @param pattern - Regex to match artifact paths in output
 * @param label - Human-readable button label
 * @param type - Artifact category for icon/styling
 */
export function addPattern(pattern: RegExp, label: string, type: ArtifactType): void {
  customPatterns.push({ regex: pattern, label, type });
}

/**
 * Scan shell output text for artifact paths.
 * Returns deduplicated ArtifactLink array ordered by detection priority.
 * @param output - Full shell output string (stdout + stderr)
 * @returns Detected artifact links for UI rendering
 */
export function detectArtifacts(output: string): ArtifactLink[] {
  const seen = new Set<string>();
  const results: ArtifactLink[] = [];

  // Priority 1: known reports
  collectMatches(KNOWN_REPORTS, output, seen, results);
  // Priority 2: custom user patterns
  collectMatches(customPatterns, output, seen, results);
  // Priority 3: generic build artifacts
  collectGenericMatches(output, seen, results);

  return results;
}

/** Run pattern list and collect unique matches */
function collectMatches(
  patterns: DetectionPattern[],
  output: string,
  seen: Set<string>,
  results: ArtifactLink[]
): void {
  for (const { regex, label, type } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(output)) !== null) {
      const path = match[0];
      if (!seen.has(path)) {
        seen.add(path);
        results.push({ label, path, type });
      }
    }
  }
}

/** Collect generic artifact paths with auto-generated labels */
function collectGenericMatches(
  output: string,
  seen: Set<string>,
  results: ArtifactLink[]
): void {
  GENERIC_ARTIFACT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GENERIC_ARTIFACT_REGEX.exec(output)) !== null) {
    const path = match[0];
    if (!seen.has(path)) {
      seen.add(path);
      results.push({
        label: inferLabel(path),
        path,
        type: inferType(path),
      });
    }
  }
}

/** Infer a human-readable label from file path */
function inferLabel(path: string): string {
  if (path.endsWith('.html')) return 'Open Report';
  if (path.endsWith('.pdf')) return 'View PDF';
  if (path.endsWith('.json')) return 'View JSON';
  if (path.endsWith('.xml')) return 'View XML';
  return 'Open Artifact';
}

/** Infer artifact type from file path content */
function inferType(path: string): ArtifactType {
  const lower = path.toLowerCase();
  if (lower.includes('coverage')) return 'coverage';
  if (lower.includes('test') || lower.includes('report')) return 'test-report';
  return 'build';
}
