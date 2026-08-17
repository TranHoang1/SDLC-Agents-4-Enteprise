/**
 * SA4E-123: find_skill dispatcher - scans .code-intel/skills SKILL.md files,
 * parses frontmatter, and returns keyword-matched results.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

type Args = Record<string, unknown>;

/** Parsed skill metadata from SKILL.md frontmatter. */
export interface SkillMeta {
  name: string;
  description: string;
  filePath: string;
}

/**
 * Parse YAML-like frontmatter from a SKILL.md file.
 * Extracts name and description fields between --- delimiters.
 */
export function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };

  const block = match[1];
  const name = extractField(block, 'name');
  const description = extractField(block, 'description');
  return { name, description };
}

function extractField(block: string, field: string): string {
  const regex = new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, 'm');
  const match = block.match(regex);
  return match ? match[1] : '';
}

/**
 * Scan the skills directory and return all skill metadata.
 * Reads .code-intel/skills/{name}/SKILL.md under the workspace root.
 */
export async function scanSkills(workspace: string): Promise<SkillMeta[]> {
  const skillsDir = join(workspace, '.code-intel', 'skills');
  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }

  const skills: SkillMeta[] = [];
  for (const entry of entries) {
    const filePath = join(skillsDir, entry, 'SKILL.md');
    try {
      const content = await readFile(filePath, 'utf-8');
      const { name, description } = parseFrontmatter(content);
      if (name) skills.push({ name, description, filePath });
    } catch {
      // Skip directories without SKILL.md
    }
  }
  return skills;
}

/**
 * Score a skill against a query using keyword matching.
 * Returns a value between 0 and 1.
 */
export function scoreMatch(skill: SkillMeta, query: string): number {
  const queryLower = query.toLowerCase();
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const haystack = (skill.name + ' ' + skill.description).toLowerCase();
  let matched = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) matched++;
  }
  return matched / tokens.length;
}

/**
 * Handler for the find_skill MCP tool.
 * Scans skills directory, matches against query, returns results.
 */
export async function handleFindSkill(workspace: string, args: Args): Promise<string> {
  const query = (args.query as string) || '';
  if (!query.trim()) {
    return JSON.stringify({ error: 'query is required' });
  }

  const skills = await scanSkills(workspace);
  if (skills.length === 0) {
    return JSON.stringify({ skills: [], count: 0, message: 'No skills found in .code-intel/skills/' });
  }

  const scored = skills
    .map(skill => ({ ...skill, score: scoreMatch(skill, query) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return JSON.stringify({
    skills: scored.map(s => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      score: Math.round(s.score * 100) / 100,
    })),
    count: scored.length,
    totalSkills: skills.length,
  });
}
