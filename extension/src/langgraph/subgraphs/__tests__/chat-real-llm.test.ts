/**
 * SA4E-85 v3.1 — Real-LLM Agentic Chat Test.
 * Builds the full system prompt (agent instructions + steering rules +
 * KB context) and sends to a real LLM via OpenAI-compatible API.
 * Run standalone:
 *   npx vitest run src/langgraph/subgraphs/__tests__/chat-real-llm.test.ts
 *
 * Config: set LLM_API_BASE (default http://localhost:1234/v1)
 *         and LLM_MODEL (default "auto")
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const API_BASE = process.env.LLM_API_BASE || 'http://localhost:1234/v1';
const MODEL = process.env.LLM_MODEL || '';

/** Resolve model: use LLM_MODEL, else the first model the server exposes. */
async function resolveModel(): Promise<string> {
  if (MODEL) { return MODEL; }
  try {
    const res = await fetch(`${API_BASE}/models`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ id: string }> };
      const id = data.data?.[0]?.id;
      if (id) { return id; }
    }
  } catch { /* fall through */ }
  return 'qwen3-4b-instruct-2507';
}

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa4e85-real-llm-'));

  // .code-intel/agents/
  const agentsDir = path.join(tmpDir, '.code-intel', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  // ba-agent.md
  fs.writeFileSync(path.join(agentsDir, 'ba-agent.md'), `---
name: ba-agent
label: Business Analyst
phase: requirements
tools: ["read", "write", "mcp"]
---
Bạn là Business Analyst. Khi có ticket, bạn phân tích yêu cầu và tạo BRD.md.
Bạn cũng tạo FSD.md (Functional Specification Document).

Backend: TypeScript + Hono + MCP SDK.
Frontend: Svelte 4 + Vite.
Orchestration: Python FastAPI + LangGraph.`);

  // dev-agent.md
  fs.writeFileSync(path.join(agentsDir, 'dev-agent.md'), `---
name: dev-agent
label: Developer
phase: implementation
tools: ["read", "write", "shell"]
---
Bạn là developer. Viết code theo SOLID, mỗi file max 200 dòng, mỗi hàm max 20 dòng. Dùng draw.io cho mọi diagram. Không bao giờ g iả định API — luôn dùng tools để đọc code.`);

  // .code-intel/steering/
  const steeringDir = path.join(tmpDir, '.code-intel', 'steering');
  fs.mkdirSync(steeringDir, { recursive: true });
  fs.writeFileSync(path.join(steeringDir, 'code-standards.md'), `---
targets: langgraph
inclusion: always
title: Code Standards
priority: 10
---
# Code Standards
- SOLID principles — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- 200 lines per file, 20 lines per function
- TypeScript + Hono + LangGraph stack
- Draw.io for ALL diagrams (NEVER 머maid)`);

  // AGENTS.md under .code-intel/
  fs.writeFileSync(path.join(tmpDir, '.code-intel', 'AGENTS.md'), `# Project Rules
Repo: SDLC-Agents-4-Enterprise
9 agents: SM, BA, TA, SA, QA, DEV, DevOps, Security, UI
Stack: TypeScript + Hono + MCP SDK (backend), TypeScript + LangGraph (extension), Svelte 4 + Vite (webview), Python FastAPI (presentation services)
Current ticket: SA4E-85 — Chat UI agentic Svelte Webview v3.1`);
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

function loadAgentInstructions(workspaceRoot: string): string {
  const agentsDir = path.join(workspaceRoot, ".code-intel", "agents");
  let mdFiles: string[] = [];
  try { mdFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md")).map(f => path.join(agentsDir, f)); }
  catch { /* ignore */ }
  if (mdFiles.length === 0) return [];
  return mdFiles.map(file => {
    const content = fs.readFileSync(file, "utf-8");
    return content.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
  });
}

function loadSteeringMarkdownFiles(workspaceRoot: string): string[] {
  const steeringDir = path.join(workspaceRoot, ".code-intel", "steering");
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(steeringDir).filter(f => f.endsWith(".md") && !f.startsWith("."));
    for (const f of entries) files.push(fs.readFileSync(path.join(steeringDir, f), "utf-8"));
  } catch {}
  return files;
}

function buildSystemPrompt(workspaceRoot: string): string {
  const agentInstructions = loadAgentInstructions(workspaceRoot);
  const steeringFiles = loadSteeringMarkdownFiles(workspaceRoot);

  // AGENTS.md content (from .code-intel/)
  const agentsMdPath = path.join(workspaceRoot, '.code-intel', 'AGENTS.md');
  const agentsMd = (() => { try { return fs.readFileSync(agentsMdPath, 'utf-8'); } catch { return ''; } })();

  // 1. Base + AGENTS.md first (most important)
  let prompt = `You are a coding assistant for **SDLC-Agents-4-Enterprise**.
Your workspace has 9 agents: SM, BA, TA, SA, QA, DEV, DevOps, Security, UI.
Stack: TypeScript + Hono + MCP SDK (backend), TypeScript + LangGraph (extension), Svelte 4 + Vite (webview), Python FastAPI (presentation services).
Always use draw.io for diagrams (NEVER Mermaid).

## PROJECT RULES
${agentsMd.slice(0, 1500).replace(/^#.*$/gm, '').trim()}

## AGENT INSTRUCTIONS
${agentInstructions.slice(0, 3).join("\n\n").slice(0, 2000)}

## STEERING RULES
${steeringFiles.map(f => {
    const body = f.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
    return body.slice(0, 800);
  }).join("\n\n---\n\n").slice(0, 2000)}

## RESPONSE STYLE
- Trả lời ngắn gọn, 5-15 dòng, bằng tiếng Việt nếu user nói tiếng Việt
- Dùng bullet points
- Trước khi trả lời về code: dùng tools đọc file`;

  return prompt.slice(0, 7000);
}

async function chat(userMessage: string, systemPrompt: string): Promise<string> {
  const model = await resolveModel();
  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  });

  const data = await response.json() as any;
  if (data.error) throw new Error(`LLM API error: ${JSON.stringify(data.error)}`);
  return data.choices?.[0]?.message?.content || '';
}

describe.skip('Real LLM — Agentic Chat', () => {
  it('should respond "Hi" with project meta knowledge', async () => {
    const prompt = buildSystemPrompt(tmpDir);
    expect(prompt).toContain('Business Analyst');
    expect(prompt).toContain('SDLC-Agents-4-Enterprise');

    const answer = await chat('Xin chào', prompt);
    console.log(`\n[LLM response] ${answer}`);
    expect(answer.length).toBeGreaterThan(5);
    // qwen model should produce some response
    expect(answer).toBeTruthy();
  }, 30_000);

  it('should review workspace when asked', async () => {
    const prompt = buildSystemPrompt(tmpDir);
    const answer = await chat('Dự án này dùng những công nghệ gì?', prompt);
    console.log(`\n[LLM response] ${answer}`);
    expect(answer.length).toBeGreaterThan(10);
    // Model should reference something from prompt even if it hallucinates
    expect(answer.toLowerCase()).toMatch(/svelte|mcp|agent|python|node|hono|typescript/i);
  }, 30_000);

  it('should answer multi-turn conversation', async () => {
    const prompt = buildSystemPrompt(tmpDir);
    // Turn 1
    const a1 = await chat('Xin chào', prompt);
    console.log(`\n[Turn 1] ${a1}`);
    expect(a1.length).toBeGreaterThan(5);
    // Turn 2 — include history
    const history = [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Xin chào' },
      { role: 'assistant', content: a1 },
      { role: 'user', content: 'Hãy mô tả kiến trúc của dự án' },
    ];
    const response2 = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: await resolveModel(), messages: history, max_tokens: 500, temperature: 0.5 }),
    });
    const data2 = await response2.json() as any;
    const a2 = data2.choices?.[0]?.message?.content || '';
    console.log(`[Turn 2] ${a2}`);
    expect(a2.length).toBeGreaterThan(10);
    expect(a2.toLowerCase()).toMatch(/agent|backend|frontend|pipeline|sdlc|architect|hono|svelte/i);
  }, 30_000);
});