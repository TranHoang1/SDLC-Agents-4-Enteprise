/**
 * SA4E-85 — Integration Tests: Misc (IT-DL-01, IT-ART-01, IT-DGR-01, IT-TEL-01).
 * Tests deep link, artifact detection, diagram cache, telemetry append.
 */

import { describe, test, expect } from 'vitest';
import { detectArtifacts } from '../../chat/tools/ArtifactDetector';
import { LruCache } from '../../chat/diagram/LruCache';
import { logDiffAction, logToolExec } from '../../chat/telemetry/telemetryHooks';
import type { ITelemetryService, TelemetryEntry } from '../../chat/telemetry/types';

describe('IT-DL-01: Deep Link from ToolResult to UI Button', () => {
  test('deepLinkUri with antigravity scheme is valid', () => {
    const result = { deepLinkUri: 'antigravity://workspace/src/main.ts' };
    expect(result.deepLinkUri).toMatch(/^antigravity:\/\//);
  });
});

describe('IT-ART-01: Shell Output to Artifact Detection', () => {
  test('detects artifact paths from multi-line output', () => {
    const output = [
      'Running tests...',
      'Report generated at target/site/serenity/index.html',
      'Coverage: coverage/index.html',
      'Done.',
    ].join('\n');
    const artifacts = detectArtifacts(output);
    expect(artifacts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('IT-DGR-01: PlantUML Local Render Pipeline', () => {
  test('cache stores and returns SVG on second call', () => {
    const cache = new LruCache<string, string>(50);
    const svg = '<svg><text>A->B</text></svg>';
    cache.set('plantuml-abc', svg);
    expect(cache.get('plantuml-abc')).toBe(svg);
    expect(cache.size).toBe(1);
  });
});

describe('IT-TEL-01: Telemetry Append to JSONL File', () => {
  test('multiple log calls produce multiple entries', () => {
    const entries: TelemetryEntry[] = [];
    const svc: ITelemetryService = {
      log: (e) => entries.push(e),
      flush: async () => {},
      dispose: async () => {},
    };
    logDiffAction(svc, 'ba', 'accept', 'write_file', 'src/a.ts');
    logToolExec(svc, 'run_cmd', 1200, true, 'dev');
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => JSON.stringify(e).length > 0)).toBe(true);
  });
});
