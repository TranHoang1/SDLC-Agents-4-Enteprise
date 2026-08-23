export interface SkillMatchResult {
  skillId: string;
  confidence: number;
}

export class SkillMatcher {
  async match(message: string): Promise<SkillMatchResult | null> {
    if (!message) return null;
    const keywords = message.toLowerCase();
    if (keywords.includes('scrape') || keywords.includes('browser')) {
      return { skillId: 'browser-harness', confidence: 0.9 };
    }
    if (keywords.includes('skill')) {
      return { skillId: 'find-skill', confidence: 0.7 };
    }
    return null;
  }
}
