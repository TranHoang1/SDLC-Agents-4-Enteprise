/**
 * SA4E-166 — OnboardingService unit and integration tests.
 * Verifies: fresh generation, cache behavior, force bypass, section completeness, time budget.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import pino from 'pino';
import { OnboardingService } from '../OnboardingService.js';

const logger = pino({ level: 'silent' });

function createTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onboard-test-'));
  // Create a minimal project structure
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'test-project',
    description: 'A test project',
    scripts: { build: 'tsc', test: 'vitest run', dev: 'tsx src/index.ts' },
    dependencies: { express: '^4.18.0', zod: '^3.21.0' },
    devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
  }));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const main = () => {};\n');
  fs.mkdirSync(path.join(dir, 'src', 'server'));
  fs.writeFileSync(path.join(dir, 'src', 'server', 'index.ts'), 'export class HttpServer {}\n');
  fs.mkdirSync(path.join(dir, 'src', 'modules'));
  fs.writeFileSync(path.join(dir, 'src', 'modules', 'index.ts'), 'export class ModuleRegistry {}\n');
  fs.mkdirSync(path.join(dir, '.code-intel'), { recursive: true });
  return dir;
}

function cleanupWorkspace(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('OnboardingService', () => {
  let workspace: string;
  let service: OnboardingService;

  beforeEach(() => {
    workspace = createTempWorkspace();
    service = new OnboardingService(workspace, logger);
  });

  afterEach(() => {
    cleanupWorkspace(workspace);
  });

  it('generates ONBOARDING.md with all required sections', async () => {
    const result = await service.generate();

    expect(result.cached).toBe(false);
    expect(result.content).toContain('# Project Overview');
    expect(result.content).toContain('## Architecture');
    expect(result.content).toContain('## Key Entry Points');
    expect(result.content).toContain('## Dependencies');
    expect(result.content).toContain('## Development Setup');
    expect(result.content).toContain('## Module Reference');
  });

  it('includes project name and tech stack from package.json', async () => {
    const result = await service.generate();

    expect(result.content).toContain('test-project');
    expect(result.content).toContain('TypeScript');
    expect(result.content).toContain('Node.js');
  });

  it('includes detected entry points', async () => {
    const result = await service.generate();

    expect(result.content).toContain('src/index.ts');
  });

  it('includes dependencies from package.json', async () => {
    const result = await service.generate();

    expect(result.content).toContain('express');
    expect(result.content).toContain('zod');
  });

  it('includes development setup scripts', async () => {
    const result = await service.generate();

    expect(result.content).toContain('npm run build');
    expect(result.content).toContain('npm run test');
  });

  it('writes ONBOARDING.md to .code-intel directory', async () => {
    await service.generate();

    const outputPath = path.join(workspace, '.code-intel', 'ONBOARDING.md');
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('# Project Overview');
  });

  it('returns cached result when no significant changes', async () => {
    const first = await service.generate();
    const second = await service.generate();

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.content).toBe(first.content);
  });

  it('force=true bypasses cache', async () => {
    await service.generate();
    const forced = await service.generate(true);

    expect(forced.cached).toBe(false);
  });

  it('invalidates cache when >20% files change', async () => {
    await service.generate();

    // Add many new files (>20% change)
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(
        path.join(workspace, `new-file-${i}.ts`),
        `export const f${i} = ${i};`,
      );
    }

    const result = await service.generate();
    expect(result.cached).toBe(false);
  });

  it('completes generation within 60 seconds (BR-1101)', async () => {
    const start = Date.now();
    await service.generate();
    const elapsed = Date.now() - start;

    // BR-1101: Must complete < 60 seconds
    expect(elapsed).toBeLessThan(60_000);
  });

  it('sets generatedAt as valid ISO timestamp', async () => {
    const result = await service.generate();

    const date = new Date(result.generatedAt);
    expect(date.toISOString()).toBe(result.generatedAt);
  });

  it('handles workspace without package.json gracefully', async () => {
    fs.unlinkSync(path.join(workspace, 'package.json'));

    const result = await service.generate();

    expect(result.content).toContain('# Project Overview');
    expect(result.content).toContain('No dependencies detected');
  });
});
