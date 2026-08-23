import { describe, it, expect } from 'vitest';
import { SkillMatcher } from '../SkillMatcher';

describe('SkillMatcher', () => {
  it('matches browser skill', async () => {
    const matcher = new SkillMatcher();
    const result = await matcher.match('please scrape website with browser');
    expect(result).not.toBeNull();
    expect(result?.skillId).toBe('browser-harness');
  });

  it('returns null for no match', async () => {
    const matcher = new SkillMatcher();
    const result = await matcher.match('hello world');
    expect(result).toBeNull();
  });
});
