import { describe, it, expect } from 'vitest';
import { AgentCompiler } from '../AgentCompiler';

describe('AgentCompiler', () => {
  it('injects skill content', () => {
    const compiler = new AgentCompiler();
    const fm = { skills: ['skillA'] };
    const contents = { skillA: 'SKILL CONTENT' };
    const prompt = compiler.compile(fm, contents);
    expect(prompt).toContain('SKILL CONTENT');
  });
});
