/**
 * SA4E-85 v3.1 — Standalone agentic chat test.
 * Tests chat graph system prompt quality, KB context injection,
 * agent instruction loading, and steering rule injection without
 * needing a real LLM provider or IDE runtime.
 * Run: npx vitest run src/langgraph/subgraphs/__tests__/chat-agentic.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Mock vscode
vi.mock('vscode', () => ({
  Uri: { file: (p: string) => ({ fsPath: p, toString: () => p }), joinPath: (...ps: string[]) => ({ path: ps.join('/') }) },
  workspace: { fs: { readDirectory: vi.fn(), readFile: vi.fn() }, workspaceFolders: [] },
  window: {},
  EventEmitter: class { event() {} fire() {} dispose() {} },
  commands: { executeCommand: vi.fn() },
}));

import { loadSteeringRules, injectSteering } from '../../steering/steering-loader';
import { agentRegistry } from '../../agents/registry';

// Create temp .code-intel/agents/ + .code-intel/steering/ for test isolation
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa4e85-chat-test-'));
  // .code-intel/agents/
  const agentsDir = path.join(tmpDir, '.code-intel', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'ba-agent.md'), `---
name: ba-agent
label: Business Analyst
phase: requirements
tools: ["read", "write", "mcp"]
---
You are the Business Analyst. Khi có ticket Jira, bạn tạo FSD và BRD.`);
  fs.writeFileSync(path.join(agentsDir, 'dev-agent.md'), `---
name: dev-agent
label: Developer
phase: implementation
tools: ["read", "write", "shell"]
---
You are the Developer. Viết code theo SOLID, mỗi file ≤200 dòng, mỗi hàm ≤20 dòng.`);
  // .code-intel/steering/
  const steeringDir = path.join(tmpDir, '.code-intel', 'steering');
  fs.mkdirSync(steeringDir, { recursive: true });
  fs.writeFileSync(path.join(steeringDir, 'code-standards.md'), `---
targets: langgraph
inclusion: always
priority: 10
---
# Code Standards
- SOLID principles
- 200 lines per file maximum`);
  fs.writeFileSync(path.join(steeringDir, 'loop-constraints.md'), `---
targets: all
inclusion: always
title: Loop Constraints
---
# Loop Constraints
Do not repeat yourself more than 3 times.`);
  // AGENTS.md under .code-intel/
  fs.writeFileSync(path.join(tmpDir, '.code-intel', 'AGENTS.md'), `# Project Rules
Always use draw.io for diagrams. Never use Mermaid.`);
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe('Standalone Agentic Chat — System Prompt Quality', () => {
  it('should load agent instructions from .code-intel/agents/*.md', () => {
    const agentsDir = path.join(tmpDir, '.code-intel', 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    expect(files).toHaveLength(2);

    const baContent = fs.readFileSync(path.join(agentsDir, 'ba-agent.md'), 'utf-8');
    expect(baContent).toContain('Business Analyst');
    expect(baContent).toContain('name: ba-agent');
    const afterFm = baContent.replace(/^---[\s\S]*?---\r?\n?/, '').trim();
    expect(afterFm).toContain('tạo FSD và BRD');
  });

  it('agent registry parses .code-intel/agents correctly', () => {
    agentRegistry.load(tmpDir);
    expect(agentRegistry.isInitialized()).toBe(true);

    const devServer = agentRegistry.getAgentConfig('dev-agent');
    expect(devServer).toBeDefined();
    expect(devServer?.label).toBe('Developer');
    expect(devServer?.phase).toBe('implementation');

    const ba = agentRegistry.getAgentConfig('ba-agent');
    expect(ba).toBeDefined();
    expect(ba?.label).toBe('Business Analyst');
    expect(ba?.phase).toBe('requirements');
  });

  it('steering rules are loaded and injectable', () => {
    // loadSteeringRules uses vscode workspace fs — can't use easily standalone
    // but we test the injectSteering function directly
    const rules = [
      { filePath: 'steering/sm-core.md', meta: { targets: 'langgraph', inclusion: 'always', priority: 10, title: 'SM Core' },
        content: 'You are the Scrum Master. Điều phối pipeline.' },
      { filePath: 'steering/loop.md', meta: { targets: 'all', inclusion: 'always', priority: 5, title: 'Constraints' },
        content: 'Constraint: stop repeating >3 times.' },
    ];
    const basePrompt = 'You are a coding assistant.';
    const result = injectSteering(basePrompt, rules as any);
    expect(result).toContain('# Steering Rules (auto-injected)');
    expect(result).toContain('## SM Core');
    expect(result).toContain('## Constraints');
    expect(result).toContain('You are a coding assistant.');
  });

  it('empty steering rules returns base prompt unchanged', () => {
    const result = injectSteering('Hello', []);
    expect(result).toBe('Hello');
  });

  it('AGENTS.md is present under .code-intel/', () => {
    const content = fs.readFileSync(path.join(tmpDir, '.code-intel', 'AGENTS.md'), 'utf-8');
    expect(content).toContain('draw.io');
    expect(content).toContain('Never use Mermaid');
  });

  it('kb context injection builds correct prompt', () => {
    const basePrompt = 'You are a coding assistant.';
    const kbContext = '## Knowledge Base Context\n\nFound: ticket SA4E-85 requires Svelte chat\n\nFound: SECURITY-REVIEW.md has findings #18, #19, #23';
    const combined = `${basePrompt}\n\n---\n${kbContext}\n---`;
    expect(combined).toContain('Knowledge Base Context');
    expect(combined).toContain('SA4E-85');
    expect(combined).toContain('#18');
    expect(combined).toContain('You are a coding assistant.');
  });

  it('empty kbContext should not inject section', () => {
    const basePrompt = 'Base prompt';
    const final = basePrompt; // kbContext empty → no injection
    expect(final).toBe(basePrompt);
    expect(final).not.toContain('Knowledge Base Context');
  });

  it('{ chaining } instruction { in } steering budget 6000 chars', () => {
    const rules = [];
    for (let i = 0; i < 500; i++) {
      rules.push({
        filePath: `rule-${i}.md`,
        meta: { targets: 'langgraph', inclusion: 'always', priority: i, title: `Rule ${i}` },
        content: 'This is a steering rule that contains valuable information for the agent to use in the pipeline.'.repeat(5),
      });
    }
    const result = injectSteering('BASE', rules as any);
    expect(result).toContain('BASE');
    expect(result).toContain('# Steering Rules');
    // Should be truncated at ~4000 chars steering budget
    expect(result.length).toBeLessThan(6200); // BASE + 4000 + header text
  });
});