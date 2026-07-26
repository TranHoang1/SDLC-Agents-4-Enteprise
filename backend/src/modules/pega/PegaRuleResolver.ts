/**
 * PegaRuleResolver — Bộ mô phỏng thuật toán Pega Rule Resolution Algorithm.
 * Thực thi 5 bước lọc và quét cây kế thừa Class (Pattern & Direct Inheritance) theo rulesetStack.
 */

export interface PegaRuleCandidate {
  fqn: string;
  ruleType: string;
  className: string;
  ruleName: string;
  ruleset?: string;
  version?: string;
  availability?: 'Yes' | 'Final' | 'No' | 'Withdrawn' | 'Blocked';
  superClassName?: string;
}

export class PegaRuleResolver {
  public static resolveRule(
    targetClass: string,
    targetName: string,
    targetType: string,
    rulesetStack: string[],
    candidates: PegaRuleCandidate[],
  ): PegaRuleCandidate | null {
    const active = candidates.filter((c) => PegaRuleResolver.isAvailable(c, targetType, targetName, rulesetStack));
    if (active.length === 0) return null;

    const classChain = PegaRuleResolver.buildClassHierarchy(targetClass);
    for (const cls of classChain) {
      const match = active.find((c) => c.className === cls);
      if (match) return match;
    }

    return active.find((c) => c.className === '@baseclass') || null;
  }

  private static isAvailable(c: PegaRuleCandidate, type: string, name: string, stack: string[]): boolean {
    if (c.ruleType !== type || c.ruleName !== name) return false;
    if (c.availability && (c.availability === 'No' || c.availability === 'Withdrawn' || c.availability === 'Blocked')) {
      return false;
    }
    if (c.ruleset && stack.length > 0 && !stack.includes(c.ruleset)) {
      return false;
    }
    return true;
  }

  public static buildClassHierarchy(targetClass: string): string[] {
    const chain: string[] = [targetClass];
    const parts = targetClass.split('-');

    // Pattern Inheritance
    while (parts.length > 1) {
      parts.pop();
      const parent = parts.join('-');
      if (parent && !chain.includes(parent)) {
        chain.push(parent);
      }
    }

    if (!chain.includes('@baseclass')) {
      chain.push('@baseclass');
    }
    return chain;
  }
}
