import { AllowlistRule } from '../models/MaskingTypes.js';
import { KnowledgeEntry } from '../../models.js';

/**
 * Checks if a KB entry is allowlisted (exempt from masking).
 * Supports: entry_id, tag, source, pattern matching.
 */
export class AllowlistService {
  private rules: AllowlistRule[] = [];

  updateRules(rules: AllowlistRule[]): void {
    this.rules = rules;
  }

  isAllowlisted(entry: KnowledgeEntry): boolean {
    for (const rule of this.rules) {
      switch (rule.rule_type) {
        case 'entry_id':
          if (String(entry.id) === rule.rule_value) return true;
          break;
        case 'tag':
          if (entry.tags?.includes(rule.rule_value)) return true;
          break;
        case 'source':
          if (entry.source === rule.rule_value) return true;
          break;
        case 'pattern':
          if (new RegExp(rule.rule_value).test(entry.content)) return true;
          break;
      }
    }
    return false;
  }
}
