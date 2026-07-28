import type { ArtifactType } from './types.js';

const CODE_LIKE_PATTERNS = [
  /\bimport\s+/,
  /\bexport\s+/,
  /\bfunction\s+\w+\s*\(/,
  /\bdef\s+\w+\s*\(/,
  /\bclass\s+\w+/,
  /\binterface\s+\w+/,
  /#include\s+/,
  /\busing\s+(System|namespace)/,
  /\bmodule\.exports\b/,
  /\brequire\s*\(/,
  /\bpublic\s+class\b/,
  /\bprivate\s+\w+/,
  /\bprotected\s+\w+/,
  /\bconst\s+\w+\s*=/,
  /\blet\s+\w+\s*=/,
  /\bvar\s+\w+\s*=/,
  /\bfun\s+\w+\s*\(/,
  /\bsub\s+\w+/,
  /\bdef\b.*\bend\b/,
  /\bpackage\s+\w+/,
  /\bnamespace\s+\w+/,
];

/**
 * Detect the artifact type of content.
 *
 * Priority order:
 * 1. pega_rule — most specific (requires pxObjClass)
 * 2. structured_data (JSON, XML) — syntax-heavy formats with clear delimiters
 * 3. code — programming language patterns (detected before YAML to avoid
 *    false positives from labels like `public:` matching YAML key:value syntax)
 * 4. structured_data (YAML) — YAML checked after code so C++ labels don't collide
 * 5. unknown
 */
export class ArtifactDetector {
  detect(content: string, hint?: string): ArtifactType {
    if (!content || content.trim().length === 0) return 'unknown';

    // Hint overrides auto-detection
    if (hint) {
      const normalized = hint.toLowerCase();
      const validTypes: ArtifactType[] = ['pega_rule', 'code', 'structured_data', 'unknown'];
      if (validTypes.includes(normalized as ArtifactType)) {
        return normalized as ArtifactType;
      }
    }

    const trimmed = content.trim();

    // 1. Pega rule detection (most specific)
    if (content.includes('"pxObjClass"') || content.includes("'pxObjClass'")) {
      return 'pega_rule';
    }

    // 2. JSON detection (syntax-validated)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'structured_data';
      } catch {
        // Not valid JSON, fall through
      }
    }

    // 3. XML detection (line starts with <tag)
    const xmlPattern = /^\s*<[A-Za-z_][A-Za-z0-9_.:-]*[\s>]/m;
    if (xmlPattern.test(trimmed)) {
      return 'structured_data';
    }

    // 4. Code detection (checked before YAML to avoid C++ labels like `public:`
    //    being misidentified as YAML key:value)
    if (CODE_LIKE_PATTERNS.some(p => p.test(content))) {
      return 'code';
    }

    // 5. YAML detection (checked last because `key: value` patterns can appear
    //    in non-YAML contexts like C++ access specifiers)
    const yamlPattern = /^[ \t]*[a-zA-Z_][a-zA-Z0-9_]*\s*:(?:[ \t]|$)/m;
    if (yamlPattern.test(trimmed)) {
      return 'structured_data';
    }

    return 'unknown';
  }
}
