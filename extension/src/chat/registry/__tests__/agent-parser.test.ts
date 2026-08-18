/**
 * SA4E-85 — Unit Tests: Agent Parser (UT-AGP-01/02).
 * Tests YAML frontmatter parsing, defaults, and invalid input handling.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseAgentFile, deriveAgentId } from '../agentParser';

function frontmatter(body: string): string {
  return `---\n${body}\n---\n# Agent Body`;
}

describe('UT-AGP-01: Valid Frontmatter Parsing', () => {
  it('parses full frontmatter into an AgentMeta', () => {
    const content = frontmatter(
      'id: code-reviewer\n' +
      'name: Code Reviewer\n' +
      'description: Reviews pull requests\n' +
      'tools:\n' +
      '  - read_file\n' +
      '  - search_text\n' +
      'mcpServers:\n' +
      '  - github\n' +
      'autoApprove:\n' +
      '  - read_file',
    );
    const meta = parseAgentFile(content, '/workspace/agents/code-reviewer.md');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('code-reviewer');
    expect(meta!.name).toBe('Code Reviewer');
    expect(meta!.description).toBe('Reviews pull requests');
    expect(meta!.tools).toEqual(['read_file', 'search_text']);
    expect(meta!.mcpServers).toEqual(['github']);
    expect(meta!.autoApprove).toEqual(['read_file']);
    expect(meta!.filePath).toBe('/workspace/agents/code-reviewer.md');
  });

  it('strips surrounding quotes from scalar values', () => {
    const content = frontmatter(
      'id: "quoted-id"\n' +
      "name: 'Quoted Name'\n" +
      'description: "A quoted description"',
    );
    const meta = parseAgentFile(content, '/agents/quoted.md');
    expect(meta!.id).toBe('quoted-id');
    expect(meta!.name).toBe('Quoted Name');
    expect(meta!.description).toBe('A quoted description');
  });

  it('parses an empty array literal as an empty list', () => {
    const content = frontmatter(
      'id: empty-tools\n' +
      'tools: []\n' +
      'mcpServers:\n' +
      '  - github',
    );
    const meta = parseAgentFile(content, '/agents/empty-tools.md');
    expect(meta!.tools).toEqual([]);
    expect(meta!.mcpServers).toEqual(['github']);
  });

  it('frontmatter id overrides the filename-derived id', () => {
    const content = frontmatter('id: explicit-id\nname: Explicit');
    const meta = parseAgentFile(content, '/agents/some-file.md');
    expect(meta!.id).toBe('explicit-id');
    expect(meta!.name).toBe('Explicit');
  });

  it('tolerates leading whitespace before the opening delimiter', () => {
    const content = `   \n${frontmatter('id: spaced\nname: Spaced')}`;
    const meta = parseAgentFile(content, '/agents/spaced.md');
    expect(meta!.id).toBe('spaced');
  });
});

describe('UT-AGP-02: Defaults and Fallback Behavior', () => {
  it('derives id and name from filename when no frontmatter exists', () => {
    const content = '# Just a markdown file';
    const meta = parseAgentFile(content, '/agents/fallback-agent.md');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('fallback-agent');
    expect(meta!.name).toBe('fallback-agent');
    expect(meta!.description).toBe('');
    expect(meta!.tools).toEqual([]);
    expect(meta!.mcpServers).toEqual([]);
    expect(meta!.autoApprove).toEqual([]);
  });

  it('uses filename defaults for an empty frontmatter block', () => {
    const content = '---\n---\n# Agent';
    const meta = parseAgentFile(content, '/agents/empty-fm.md');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('empty-fm');
    expect(meta!.name).toBe('empty-fm');
  });

  it('uses filename defaults when the closing delimiter is missing', () => {
    const content = '---\nid: never-closed\n# Agent';
    const meta = parseAgentFile(content, '/agents/unclosed.md');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('unclosed');
  });

  it('uses filename defaults when frontmatter has no recognized fields', () => {
    const content = frontmatter('unknownField: value');
    const meta = parseAgentFile(content, '/agents/unknown-field.md');
    expect(meta!.id).toBe('unknown-field');
    expect(meta!.tools).toEqual([]);
  });

  it('logs a warning when frontmatter is missing', () => {
    const logger = vi.fn();
    parseAgentFile('# No frontmatter', '/agents/no-fm.md', logger);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('No frontmatter'));
  });

  it('logs a warning for empty or unclosed frontmatter', () => {
    const logger = vi.fn();
    parseAgentFile('---\nid: x\n# never closed', '/agents/x.md', logger);
    expect(logger).toHaveBeenCalled();
  });

  it('never throws on malformed frontmatter', () => {
    const weirdInputs = [
      '---\ninvalid: [unclosed bracket\n: broken\n---',
      '---\n  - orphan-array-item\n---',
      '------\n',
      '',
      '---',
    ];
    for (const input of weirdInputs) {
      expect(() => parseAgentFile(input, '/agents/weird.md')).not.toThrow();
    }
  });
});

describe('UT-AGP-03: deriveAgentId', () => {
  it('extracts the filename without the .md extension', () => {
    expect(deriveAgentId('/path/to/my-agent.md')).toBe('my-agent');
    expect(deriveAgentId('agents/ba-agent.md')).toBe('ba-agent');
    expect(deriveAgentId('agents/dev-agent.md')).toBe('dev-agent');
  });
});
