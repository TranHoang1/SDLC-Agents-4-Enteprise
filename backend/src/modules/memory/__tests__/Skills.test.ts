/**
 * SA4E-123: find_skill tool — unit tests.
 * Tests frontmatter parsing, keyword scoring, and the handleFindSkill dispatcher.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseFrontmatter,
  scoreMatch,
  scanSkills,
  handleFindSkill,
} from '../dispatchers/skills.js';
import type { SkillMeta } from '../dispatchers/skills.js';

describe('parseFrontmatter', () => {
  it('extracts name and description from valid frontmatter', () => {
    const content = `---
name: hono-patterns
description: "Hono framework patterns for this project."
---

# hono-patterns
Body content here.`;
    const { name, description } = parseFrontmatter(content);
    expect(name).toBe('hono-patterns');
    expect(description).toBe('Hono framework patterns for this project.');
  });

  it('handles frontmatter without quotes', () => {
    const content = `---
name: sqlite-patterns
description: SQLite patterns for DB operations
---
# Body`;
    const { name, description } = parseFrontmatter(content);
    expect(name).toBe('sqlite-patterns');
    expect(description).toBe('SQLite patterns for DB operations');
  });

  it('returns empty for content without frontmatter', () => {
    const content = '# Just a heading\nNo frontmatter.';
    const { name, description } = parseFrontmatter(content);
    expect(name).toBe('');
    expect(description).toBe('');
  });

  it('returns empty for empty string', () => {
    const { name, description } = parseFrontmatter('');
    expect(name).toBe('');
    expect(description).toBe('');
  });
});

describe('scoreMatch', () => {
  const skill: SkillMeta = {
    name: 'hono-patterns',
    description: 'Hono framework patterns for routes and middleware',
    filePath: '/skills/hono-patterns/SKILL.md',
  };

  it('returns 1.0 for exact single-token match', () => {
    expect(scoreMatch(skill, 'hono')).toBe(1.0);
  });

  it('returns 1.0 when all tokens match', () => {
    expect(scoreMatch(skill, 'hono routes')).toBe(1.0);
  });

  it('returns partial score for partial matches', () => {
    const score = scoreMatch(skill, 'hono database');
    expect(score).toBe(0.5); // 1 of 2 tokens match
  });

  it('returns 0 for no matches', () => {
    expect(scoreMatch(skill, 'python django')).toBe(0);
  });

  it('returns 0 for empty query', () => {
    expect(scoreMatch(skill, '')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(scoreMatch(skill, 'HONO')).toBe(1.0);
  });
});

describe('scanSkills', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'skills-test-'));
    const skillsDir = join(tmpDir, '.code-intel', 'skills');
    await mkdir(join(skillsDir, 'test-skill'), { recursive: true });
    await writeFile(
      join(skillsDir, 'test-skill', 'SKILL.md'),
      `---\nname: test-skill\ndescription: "A test skill"\n---\n# test-skill\nBody.`,
    );
    await mkdir(join(skillsDir, 'another-skill'), { recursive: true });
    await writeFile(
      join(skillsDir, 'another-skill', 'SKILL.md'),
      `---\nname: another-skill\ndescription: "Another skill for testing"\n---\n# another\nBody.`,
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('finds all skills in directory', async () => {
    const skills = await scanSkills(tmpDir);
    expect(skills).toHaveLength(2);
    expect(skills.map(s => s.name).sort()).toEqual(['another-skill', 'test-skill']);
  });

  it('returns empty for non-existent directory', async () => {
    const skills = await scanSkills('/nonexistent/path');
    expect(skills).toEqual([]);
  });

  it('includes filePath for each skill', async () => {
    const skills = await scanSkills(tmpDir);
    for (const skill of skills) {
      expect(skill.filePath).toContain('SKILL.md');
    }
  });
});

describe('handleFindSkill', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'find-skill-'));
    const skillsDir = join(tmpDir, '.code-intel', 'skills');
    await mkdir(join(skillsDir, 'hono-patterns'), { recursive: true });
    await writeFile(
      join(skillsDir, 'hono-patterns', 'SKILL.md'),
      `---\nname: hono-patterns\ndescription: "Hono framework patterns for routes and middleware"\n---\n# hono\n`,
    );
    await mkdir(join(skillsDir, 'sqlite-patterns'), { recursive: true });
    await writeFile(
      join(skillsDir, 'sqlite-patterns', 'SKILL.md'),
      `---\nname: sqlite-patterns\ndescription: "SQLite database patterns for repositories"\n---\n# sqlite\n`,
    );
    await mkdir(join(skillsDir, 'vitest-testing'), { recursive: true });
    await writeFile(
      join(skillsDir, 'vitest-testing', 'SKILL.md'),
      `---\nname: vitest-testing\ndescription: "Vitest testing patterns for unit and integration tests"\n---\n# vitest\n`,
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error for empty query', async () => {
    const result = await handleFindSkill(tmpDir, { query: '' });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('query is required');
  });

  it('returns matching skills for valid query', async () => {
    const result = await handleFindSkill(tmpDir, { query: 'hono' });
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(1);
    expect(parsed.skills[0].name).toBe('hono-patterns');
    expect(parsed.skills[0].score).toBe(1.0);
  });

  it('returns multiple matches ranked by score', async () => {
    const result = await handleFindSkill(tmpDir, { query: 'patterns' });
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(3); // all have "patterns" in name or description
    expect(parsed.skills[0].score).toBeGreaterThan(0);
  });

  it('returns empty when no skills match', async () => {
    const result = await handleFindSkill(tmpDir, { query: 'python django' });
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(0);
    expect(parsed.skills).toEqual([]);
  });

  it('reports totalSkills count', async () => {
    const result = await handleFindSkill(tmpDir, { query: 'testing' });
    const parsed = JSON.parse(result);
    expect(parsed.totalSkills).toBe(3);
  });

  it('returns no-skills message for empty workspace', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'empty-'));
    const result = await handleFindSkill(emptyDir, { query: 'anything' });
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(0);
    expect(parsed.message).toContain('No skills found');
    await rm(emptyDir, { recursive: true, force: true });
  });
});
