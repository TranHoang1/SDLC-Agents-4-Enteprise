/**
 * KSA-162 — Unit tests for the EntryPointDetector orchestrator.
 */

import { describe, it, expect } from 'vitest';
import { EntryPointDetector } from '../EntryPointDetector.js';
import { makeFakeAdapter } from './fake-adapter.js';

describe('EntryPointDetector', () => {
  it('detects and stores a nesting http handler entry point', async () => {
    const adapter = makeFakeAdapter();
    const detector = new EntryPointDetector(adapter, 'p1');
    const source = "import { Controller, Get } from '@nestjs/common';";
    const symbols = [
      { id: 1, name: 'UsersController', decorators: ['@Controller("users")'], parentName: null, filePath: 'users.controller.ts', startLine: 0 },
      { id: 2, name: 'list', decorators: ['@Get(":id")'], parentName: 'UsersController', filePath: 'users.controller.ts', startLine: 5 },
    ];

    const entries = await detector.detectFile('users.controller.ts', source, 'typescript', symbols);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      symbol_id: 2,
      symbol_name: 'list',
      entry_type: 'HTTP_HANDLER',
      framework: 'nestjs',
      http_method: 'GET',
      full_route: '/users/{id}',
    });

    const insert = adapter.writes.find(w => w.sql.includes('INSERT OR REPLACE INTO entry_points'));
    expect(insert).toBeDefined();
    expect(insert!.params[0]).toBe(2);
  });

  it('returns no entry points and writes nothing for unmatched source', async () => {
    const adapter = makeFakeAdapter();
    const detector = new EntryPointDetector(adapter, 'p1');
    const entries = await detector.detectFile(
      'lib.py', 'def helper():\n    return 1', 'ruby',
      [{ id: 1, name: 'helper', filePath: 'lib.py', startLine: 0 }],
    );
    expect(entries).toEqual([]);
    expect(adapter.writes.filter(w => w.sql.includes('entry_points'))).toHaveLength(0);
  });

  it('delegates queries to the store', async () => {
    const adapter = makeFakeAdapter();
    const detector = new EntryPointDetector(adapter);
    const result = await detector.query({ entryType: 'MAIN', limit: 10 });
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.summary).toEqual({ byType: {}, byFramework: {}, authCoverage: { withAuth: 0, withoutAuth: 0 } });
  });
});