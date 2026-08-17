/**
 * SA4E-132 — GateGuardService: business logic for command evaluation + denylist management.
 * Chain of Responsibility: patterns checked sequentially, first match wins.
 * Facade: hides regex compilation, caching, and audit from consumers.
 *
 * Performance: Pre-compiled RegExp cached in memory; evaluation < 50ms.
 * SEC-05: ReDoS-prone patterns rejected before adding to denylist.
 */

import { createHash } from 'crypto';
import type { Logger } from 'pino';
import type { GateGuardRepository } from './GateGuardRepository.js';
import type { DenyPattern, EvalResult, AuditEntry, GateGuardAction } from './models.js';

/** BR-1201: Default destructive command patterns */
const DEFAULT_PATTERNS: DenyPattern[] = [
  { id: 'default-force-push', regex: 'git push --force.*', description: 'Force push', isDefault: true },
  { id: 'default-force-push-f', regex: 'git push -f.*', description: 'Force push short flag', isDefault: true },
  { id: 'default-rm-rf', regex: 'rm -rf\\s+(/|~|\\.\\.)', description: 'Recursive delete of root/home/parent', isDefault: true },
  { id: 'default-drop-table', regex: 'DROP\\s+TABLE', description: 'SQL DROP TABLE', isDefault: true },
  { id: 'default-drop-db', regex: 'DROP\\s+DATABASE', description: 'SQL DROP DATABASE', isDefault: true },
  { id: 'default-delete-no-where', regex: 'DELETE\\s+FROM\\s+\\w+\\s*;?\\s*$', description: 'DELETE without WHERE clause', isDefault: true },
  { id: 'default-git-reset-hard', regex: 'git reset --hard', description: 'Hard reset', isDefault: true },
  { id: 'default-kubectl-delete-ns', regex: 'kubectl delete namespace', description: 'Delete k8s namespace', isDefault: true },
  { id: 'default-docker-prune', regex: 'docker system prune -a', description: 'Docker full prune', isDefault: true },
];

/** SEC-05: Input that forces catastrophic backtracking for naive pattern detection. */
const REDOS_TEST_INPUT = 'a'.repeat(25) + 'x';
const REDOS_TIMEOUT_MS = 100;

export class GateGuardService {
  private compiledPatterns: Array<{ pattern: DenyPattern; regex: RegExp }> = [];
  private cacheValid = false;
  private customPatternSeq = 0;

  constructor(
    private readonly repository: GateGuardRepository,
    private readonly logger: Logger,
  ) {}

  /** Initialize cache with default + custom patterns */
  loadPatterns(projectId?: string): void {
    const customPatterns = this.repository.getPatterns(projectId);
    const allPatterns = [...DEFAULT_PATTERNS, ...customPatterns];
    this.compiledPatterns = allPatterns
      .map(p => this.compilePattern(p))
      .filter((p): p is { pattern: DenyPattern; regex: RegExp } => p !== null);
    this.cacheValid = true;
  }

  /** BR-1201/BR-1203: Evaluate a command against the denylist. < 50ms target. */
  evaluate(command: string, agent?: string, projectId?: string): EvalResult {
    const start = performance.now();
    if (!this.cacheValid) this.loadPatterns(projectId);

    for (const { pattern, regex } of this.compiledPatterns) {
      if (regex.test(command)) {
        const hash = this.generateOverrideHash(command);
        const latencyMs = Math.round(performance.now() - start);
        this.logAudit(command, agent, pattern.regex, 'blocked', projectId);
        return {
          action: 'blocked',
          patternMatched: pattern.regex,
          explanation: `Destructive command blocked by GateGuard: ${command.slice(0, 100)}`,
          overrideHash: hash,
          latencyMs,
        };
      }
    }

    const latencyMs = Math.round(performance.now() - start);
    return { action: 'allowed', latencyMs };
  }

  /** BR-1202: Process override — requires admin role (SEC-01) */
  processOverride(hash: string, user: string, role?: string): boolean {
    if (role !== 'gateguard_admin') {
      this.logger.warn({ user, role }, 'Override rejected: missing gateguard_admin role');
      return false;
    }
    this.logger.info({ user, hash }, 'GateGuard override approved');
    return true;
  }

  /** BR-1205: Add custom denylist pattern with ReDoS validation (SEC-05) */
  addPattern(regex: string, description: string, projectId?: string): DenyPattern {
    this.validateNotReDoS(regex);
    const id = `custom-${++this.customPatternSeq}`;
    const pattern: DenyPattern = { id, regex, description, isDefault: false, projectId };
    this.repository.addPattern(pattern);
    this.invalidateCache();
    return pattern;
  }

  /** Remove a custom pattern — defaults cannot be removed */
  removePattern(patternId: string): boolean {
    const removed = this.repository.removePattern(patternId);
    if (removed) this.invalidateCache();
    return removed;
  }

  /** List all patterns (default + custom) */
  listPatterns(projectId?: string): DenyPattern[] {
    const custom = this.repository.getPatterns(projectId);
    return [...DEFAULT_PATTERNS, ...custom];
  }

  /** Query audit log */
  getAuditLog(projectId?: string, limit?: number, actionFilter?: GateGuardAction): AuditEntry[] {
    return this.repository.queryAudit(projectId, limit, actionFilter);
  }

  /** Invalidate compiled regex cache — forces reload on next evaluate */
  invalidateCache(): void {
    this.cacheValid = false;
    this.compiledPatterns = [];
  }

  /** SEC-05: Reject ReDoS-prone regex patterns before adding */
  private validateNotReDoS(regex: string): void {
    try {
      const re = new RegExp(regex, 'i');
      const start = performance.now();
      re.test(REDOS_TEST_INPUT);
const elapsed = performance.now() - start;
      if (elapsed > REDOS_TIMEOUT_MS) {
        throw new Error(`Invalid regex: pattern appears ReDoS-prone (took ${elapsed.toFixed(1)}ms on test input)`);
      }
    } catch (err) {
      if ((err as Error).message.includes('ReDoS-prone')) throw err;
      throw new Error(`Invalid regex pattern: ${(err as Error).message}`);
    }
  }

  private compilePattern(p: DenyPattern): { pattern: DenyPattern; regex: RegExp } | null {
    try {
      return { pattern: p, regex: new RegExp(p.regex, 'i') };
    } catch {
      this.logger.warn({ patternId: p.id, regex: p.regex }, 'Failed to compile denylist regex');
      return null;
    }
  }

  private generateOverrideHash(command: string): string {
    return createHash('sha256').update(command).digest('hex').slice(0, 12);
  }

  private logAudit(
    command: string, agent: string | undefined,
    patternMatched: string, action: GateGuardAction, projectId?: string,
  ): void {
    try {
      this.repository.insertAudit({ command, agent, patternMatched, action, projectId });
    } catch (err) {
      this.logger.error({ err }, 'Failed to write GateGuard audit entry');
    }
  }
}
