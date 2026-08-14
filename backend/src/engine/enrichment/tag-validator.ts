/**
 * SA4E-107: Tag validation for LLM-generated enrichment tags.
 * Discards tags with invalid categories, normalizes format.
 */

import { VALID_TAG_CATEGORIES, type TagCategory } from './types.js';

const CATEGORY_SET = new Set<string>(VALID_TAG_CATEGORIES);

/** Regex: only lowercase alphanumeric + hyphens allowed in tag values. */
const TAG_VALUE_PATTERN = /^[a-z0-9-]+$/;

/**
 * Validate and filter LLM-generated tags.
 * Format: `{category}:{value}` — discards invalid category or malformed tags.
 * @param tags - Raw tags from LLM response
 * @returns Array of validated tags in `category:value` format
 */
export function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  const validated: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const normalized = raw.toLowerCase().trim();
    const colonIdx = normalized.indexOf(':');
    if (colonIdx <= 0) continue;

    const category = normalized.substring(0, colonIdx);
    const value = normalized.substring(colonIdx + 1);

    if (!CATEGORY_SET.has(category)) continue;
    if (!value || !TAG_VALUE_PATTERN.test(value)) continue;
    // Prevent excessively long tag values
    if (value.length > 50) continue;

    validated.push(`${category}:${value}`);
  }

  // Deduplicate
  return [...new Set(validated)];
}

/**
 * Check if a single tag string belongs to a valid category.
 * @param tag - Tag in `category:value` format
 */
export function isValidTagCategory(tag: string): boolean {
  const colonIdx = tag.indexOf(':');
  if (colonIdx <= 0) return false;
  return CATEGORY_SET.has(tag.substring(0, colonIdx) as TagCategory);
}
