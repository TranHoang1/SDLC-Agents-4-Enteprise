/**
 * enrich-validation.ts — SA4E-79: Input validation for mem_enrich tool.
 * Implements F-02 (structured_map schema validation) and F-01 (sanitization).
 * Separated from handler to respect SRP.
 */

/** Allowed keys in structured_map — rejects unknown keys (F-02). */
const ALLOWED_MAP_KEYS = ['summary', 'business_entities', 'actors', 'business_rules', 'tags'];

const MAX_SUMMARY_LENGTH = 500;
const MAX_TAGS_LENGTH = 500;
const MAX_STRUCTURED_MAP_BYTES = 102400; // 100KB

/**
 * Sanitize text by removing angle brackets to prevent stored XSS (F-01).
 * @param text - Raw input text
 * @returns Sanitized text with HTML brackets removed
 */
export function sanitizeText(text: string): string {
  return text.trim().replace(/[<>]/g, '');
}

/**
 * Validate entry_id is a positive integer.
 * @param entryId - The entry ID to validate
 * @returns Error message or null if valid
 */
export function validateEntryId(entryId: unknown): string | null {
  if (!entryId || typeof entryId !== 'number' || entryId <= 0) {
    return 'Error: Invalid entry_id';
  }
  return null;
}

/**
 * Validate summary field — must be non-empty, max 500 chars.
 * @param summary - The summary to validate
 * @returns Error message or null if valid
 */
export function validateSummary(summary: unknown): string | null {
  if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
    return 'Error: Invalid metadata - summary required';
  }
  if ((summary as string).length > MAX_SUMMARY_LENGTH) {
    return 'Error: Invalid metadata - summary too long (max 500)';
  }
  return null;
}

/**
 * Validate tags field — optional but max 500 chars.
 * @param tags - The tags string to validate
 * @returns Error message or null if valid
 */
export function validateTags(tags: unknown): string | null {
  if (tags && typeof tags === 'string' && tags.length > MAX_TAGS_LENGTH) {
    return 'Error: Invalid metadata - tags too long (max 500)';
  }
  return null;
}

/**
 * Validate structured_map schema — reject unknown keys, validate types (F-02).
 * @param map - The structured_map object to validate
 * @returns Error message or null if valid
 */
export function validateStructuredMap(map: unknown): string | null {
  if (!map) return null;
  if (typeof map !== 'object' || Array.isArray(map)) {
    return 'Error: Invalid metadata - structured_map must be an object';
  }
  const mapObj = map as Record<string, unknown>;
  // Reject unknown keys (F-02)
  for (const key of Object.keys(mapObj)) {
    if (!ALLOWED_MAP_KEYS.includes(key)) {
      return `Error: Invalid metadata - structured_map has unknown key: ${key}`;
    }
  }
  // Validate array fields contain only strings
  for (const key of ['business_entities', 'actors', 'business_rules', 'tags']) {
    if (mapObj[key] && (!Array.isArray(mapObj[key]) || !(mapObj[key] as unknown[]).every(v => typeof v === 'string'))) {
      return `Error: Invalid metadata - structured_map.${key} must be string array`;
    }
  }
  // Validate summary is string
  if (mapObj.summary !== undefined && typeof mapObj.summary !== 'string') {
    return 'Error: Invalid metadata - structured_map.summary must be string';
  }
  // Size check
  const json = JSON.stringify(map);
  if (json.length > MAX_STRUCTURED_MAP_BYTES) {
    return 'Error: Invalid metadata - structured_map too large (max 100KB)';
  }
  return null;
}
