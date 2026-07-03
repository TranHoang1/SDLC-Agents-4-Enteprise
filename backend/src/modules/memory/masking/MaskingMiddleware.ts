import { KnowledgeEntry } from '../models.js';
import { PiiDetector } from './detectors/PiiDetector.js';
import { CredentialDetector } from './detectors/CredentialDetector.js';
import { ContentMasker } from './maskers/ContentMasker.js';
import { AllowlistService } from './services/AllowlistService.js';
import { AuditService } from './services/AuditService.js';
import { ConfigCacheService } from './services/ConfigCacheService.js';
import {
  DetectionResult, MaskedEntry, MaskingOptions,
  SensitivityLevel,
} from './models/MaskingTypes.js';

const ROLE_ACCESS: Record<string, SensitivityLevel[]> = {
  ADMIN: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
  DEVELOPER: ['PUBLIC'],
  USER: ['PUBLIC'],
  EXTERNAL: ['PUBLIC'],
};

/**
 * Main orchestrator for the masking pipeline.
 */
export class MaskingMiddleware {
  private piiDetector: PiiDetector;
  private credDetector: CredentialDetector;
  private masker: ContentMasker;
  private allowlist: AllowlistService;
  private audit: AuditService;
  private configCache: ConfigCacheService;

  constructor(
    configCache: ConfigCacheService,
    allowlist: AllowlistService,
    audit: AuditService
  ) {
    this.configCache = configCache;
    this.allowlist = allowlist;
    this.audit = audit;
    this.masker = new ContentMasker();
    this.piiDetector = new PiiDetector();
    this.credDetector = new CredentialDetector();
  }

  applyMasking(
    entries: KnowledgeEntry[],
    requesterRole: string,
    requesterId: string,
    options?: MaskingOptions
  ): MaskedEntry[] {
    const reveal = options?.reveal ?? false;
    const results: MaskedEntry[] = [];
    for (const entry of entries) {
      const masked = this.processEntry(entry, requesterRole, requesterId, reveal);
      if (!masked.hidden) results.push(masked);
    }
    return results;
  }

  private processEntry(
    entry: KnowledgeEntry, role: string, requesterId: string, reveal: boolean
  ): MaskedEntry {
    if (this.allowlist.isAllowlisted(entry)) {
      this.audit.logEvent({
        entry_id: entry.id, requester_id: requesterId, requester_role: role,
        action: 'skip_allowlist', patterns_matched: '', sensitivity_level: 'PUBLIC',
      });
      return this.toMaskedEntry(entry, 'PUBLIC', false, []);
    }

    const level = this.classifyEntry(entry);

    if (!this.canAccess(role, level)) {
      this.audit.logEvent({
        entry_id: entry.id, requester_id: requesterId, requester_role: role,
        action: 'hide', patterns_matched: '', sensitivity_level: level,
      });
      return { id: entry.id, content: '', summary: '', masking_applied: true,
        sensitivity_level: level, masked_patterns: [], hidden: true };
    }

    const pii = this.detectSafe(() => this.piiDetector.detect(entry.content));
    const creds = this.detectSafe(() => this.credDetector.detect(entry.content));
    const all = [...pii, ...creds];
    const patterns = [...new Set(all.map(d => d.type))];

    let content = entry.content;
    if (all.length > 0) {
      const toMask = all.filter(d => {
        if (d.category === 'credential') return !(reveal && role === 'ADMIN');
        if (d.category === 'pii') return role !== 'ADMIN';
        return true;
      });
      content = this.masker.applyMasking(content, toMask, role, level, reveal);
    }

    if (level === 'CONFIDENTIAL' && role !== 'ADMIN') {
      this.audit.logEvent({
        entry_id: entry.id, requester_id: requesterId, requester_role: role,
        action: 'summary_only', patterns_matched: patterns.join(','), sensitivity_level: level,
      });
      return this.toMaskedEntry(entry, level, true, patterns, entry.summary);
    }

    if (all.length > 0) {
      const action = reveal ? 'reveal' : creds.length > 0 ? 'mask_credential' : 'mask_pii';
      this.audit.logEvent({
        entry_id: entry.id, requester_id: requesterId, requester_role: role,
        action, patterns_matched: patterns.join(','), sensitivity_level: level,
      });
    }

    return this.toMaskedEntry(entry, level, all.length > 0, patterns, content);
  }

  private classifyEntry(entry: KnowledgeEntry): SensitivityLevel {
    const creds = this.credDetector.detect(entry.content);
    if (creds.length > 0) return 'RESTRICTED';
    const pii = this.piiDetector.detect(entry.content);
    if (pii.length > 0) return 'INTERNAL';
    return 'PUBLIC';
  }

  private canAccess(role: string, level: SensitivityLevel): boolean {
    if (role === 'ADMIN') return true;
    if (level === 'RESTRICTED') return false;
    return true;
  }

  private detectSafe(fn: () => DetectionResult[]): DetectionResult[] {
    try { return fn(); } catch { return []; }
  }

  private toMaskedEntry(
    e: KnowledgeEntry, level: SensitivityLevel,
    masked: boolean, patterns: string[], content?: string
  ): MaskedEntry {
    return {
      id: e.id, content: content ?? e.content, summary: e.summary,
      masking_applied: masked, sensitivity_level: level,
      masked_patterns: patterns, hidden: false,
    };
  }
}
