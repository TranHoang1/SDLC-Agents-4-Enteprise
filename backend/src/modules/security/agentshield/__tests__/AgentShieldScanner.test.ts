/**
 * SA4E-128 — AgentShieldScanner unit tests.
 * Tests scanning rules, path traversal rejection, rule filtering, and summary.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AgentShieldScanner } from '../AgentShieldScanner.js';
import { SecretDetector } from '../rules/SecretDetector.js';
import { HttpEndpointRule } from '../rules/HttpEndpointRule.js';
import { InjectionDetector } from '../rules/InjectionDetector.js';
import { PermissionRule } from '../rules/PermissionRule.js';
import { TlsValidator } from '../rules/TlsValidator.js';

// Use a temp dir as workspace for tests
const WORKSPACE = path.resolve(__dirname, '__fixtures__');

/** Create a mock pino logger */
function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  } as unknown as import('pino').Logger;
}

/** Helper: write a temp file for scanning */
function writeFixture(filename: string, content: string): void {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.writeFileSync(path.join(WORKSPACE, filename), content, 'utf-8');
}

/** Helper: remove fixture dir */
function cleanFixtures(): void {
  if (fs.existsSync(WORKSPACE)) {
    fs.rmSync(WORKSPACE, { recursive: true, force: true });
  }
}

describe('AgentShieldScanner', () => {
  let scanner: AgentShieldScanner;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    cleanFixtures();
    logger = createMockLogger();
    scanner = new AgentShieldScanner(WORKSPACE, logger);
    scanner.registerRule(new SecretDetector());
    scanner.registerRule(new HttpEndpointRule());
    scanner.registerRule(new InjectionDetector());
    scanner.registerRule(new PermissionRule());
    scanner.registerRule(new TlsValidator());
  });

  afterAll(() => cleanFixtures());

  it('detects hardcoded AWS key (SHIELD-001 CRITICAL)', async () => {
    writeFixture('config.json', '{\n  "aws_key": "AKIAIOSFODNN7EXAMPLE"\n}');
    const result = await scanner.scan(['config.json']);
    const finding = result.findings.find((f) => f.rule === 'SHIELD-001');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('CRITICAL');
    expect(finding!.line).toBe(2);
  });

  it('detects OpenAI key pattern (SHIELD-001 CRITICAL)', async () => {
    writeFixture('mcp.json', '{\n  "key": "sk-abcdefghij1234567890abcdef"\n}');
    const result = await scanner.scan(['mcp.json']);
    const finding = result.findings.find((f) => f.rule === 'SHIELD-001');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('CRITICAL');
    expect(finding!.message).toContain('OpenAI');
  });

  it('detects HTTP MCP server URL (SHIELD-002 HIGH)', async () => {
    const content = '{\n  "url": "http://remote-server.com:8080/mcp"\n}';
    writeFixture('servers.json', content);
    const result = await scanner.scan(['servers.json']);
    const finding = result.findings.find((f) => f.rule === 'SHIELD-002');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('HIGH');
  });

  it('allows localhost HTTP (no finding for SHIELD-002)', async () => {
    const content = '{\n  "url": "http://localhost:9181/mcp"\n}';
    writeFixture('local.json', content);
    const result = await scanner.scan(['local.json']);
    const httpFindings = result.findings.filter((f) => f.rule === 'SHIELD-002');
    expect(httpFindings).toHaveLength(0);
  });

  it('detects ${} injection in config (SHIELD-003 HIGH)', async () => {
    const content = '{\n  "prompt": "${process.env.SECRET}"\n}';
    writeFixture('agent.json', content);
    const result = await scanner.scan(['agent.json']);
    const finding = result.findings.find((f) => f.rule === 'SHIELD-003');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('HIGH');
  });

  it('detects rejectUnauthorized:false (SHIELD-005 LOW)', async () => {
    const content = '{\n  "rejectUnauthorized": false\n}';
    writeFixture('tls.json', content);
    const result = await scanner.scan(['tls.json']);
    const finding = result.findings.find((f) => f.rule === 'SHIELD-005');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('LOW');
  });

  it('summary counts are correct', async () => {
    const content = [
      '{',
      '  "key": "AKIAIOSFODNN7EXAMPLE",',
      '  "url": "http://evil.com/mcp",',
      '  "prompt": "${inject}",',
      '  "rejectUnauthorized": false',
      '}',
    ].join('\n');
    writeFixture('multi.json', content);
    const result = await scanner.scan(['multi.json']);
    expect(result.summary.critical).toBeGreaterThanOrEqual(1);
    expect(result.summary.high).toBeGreaterThanOrEqual(2);
    expect(result.summary.low).toBeGreaterThanOrEqual(1);
  });

  it('rejects path traversal', async () => {
    const result = await scanner.scan(['../../etc/passwd']);
    expect(result.findings).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rule filtering works (pass specific rule IDs)', async () => {
    const content = '{\n  "key": "AKIAIOSFODNN7EXAMPLE",\n  "rejectUnauthorized": false\n}';
    writeFixture('filtered.json', content);
    const result = await scanner.scan(['filtered.json'], ['SHIELD-005']);
    const ruleIds = result.findings.map((f) => f.rule);
    expect(ruleIds).toContain('SHIELD-005');
    expect(ruleIds).not.toContain('SHIELD-001');
  });

  it('empty paths returns empty findings', async () => {
    const result = await scanner.scan([]);
    expect(result.findings).toHaveLength(0);
    expect(result.summary).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });
});
