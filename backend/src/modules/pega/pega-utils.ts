/**
 * pega-utils — Shared utility functions for Pega module.
 * Category classification, tag parsing, etc.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Extract a value from CSV-formatted tags by key prefix (e.g. "checksum:abc123"). */
export function extractTagValueCsv(tags: string, key: string): string | null {
  for (const tag of tags.split(',')) {
    const trimmed = tag.trim();
    if (trimmed.startsWith(key + ':')) return trimmed.slice(key.length + 1);
  }
  return null;
}

interface CategoryRule {
  category: string;
  keywords: string[];
}

const CATEGORY_RULES_PATH = path.resolve(__dirname, '../../../.code-intel/pega-categories.json');

function loadCategoryRules(): CategoryRule[] {
  try {
    if (fs.existsSync(CATEGORY_RULES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CATEGORY_RULES_PATH, 'utf-8'));
      if (Array.isArray(raw.rules) && raw.rules.length > 0) return raw.rules;
    }
  } catch (err) {
    console.debug('[pega-utils] ignore :', (err as Error).message);
  }
  return [];
}

function autoCategory(shortName: string): string {
  const segment = shortName.replace(/^Rule-Obj-/i, '').split('-')[0];
  if (!segment) return 'OTHER';
  return segment.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toUpperCase();
}

let _categoryRules: CategoryRule[] | null = null;

function getCategoryRules(): CategoryRule[] {
  if (_categoryRules === null) _categoryRules = loadCategoryRules();
  return _categoryRules;
}

/** Map pxObjClass to a graph node type using category rules or auto-detection. */
export function pxObjClassToGraphType(pxObjClass: string): string {
  const rules = getCategoryRules();
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (pxObjClass.includes(kw)) return rule.category;
    }
  }
  return autoCategory(pxObjClass);
}
