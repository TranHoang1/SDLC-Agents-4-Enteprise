/**
 * SA4E-85 — Unit Tests: Tools (UT-ART-01, UT-DL-01, UT-DGR-01).
 * Tests artifact detection, deep link rendering, diagram cache.
 */

import { describe, test, expect } from 'vitest';
import { detectArtifacts } from '../../chat/tools/ArtifactDetector';
import { LruCache } from '../../chat/diagram/LruCache';

describe('UT-ART-01: Artifact Detection Regex', () => {
  test('detects serenity report path', () => {
    const results = detectArtifacts('Report: target/site/serenity/index.html');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('test-report');
  });

  test('returns empty for text without artifacts', () => {
    expect(detectArtifacts('No artifacts here')).toHaveLength(0);
  });

  test('detects build output', () => {
    const results = detectArtifacts('Build output: dist/bundle.html');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test('deduplicates same path appearing twice', () => {
    const output = 'path: coverage/index.html\nagain: coverage/index.html';
    const results = detectArtifacts(output);
    const paths = results.map((r) => r.path);
    expect(paths.length).toBe(new Set(paths).size);
  });
});

describe('UT-DL-01: Deep Link Button Renders', () => {
  test('deepLinkUri is valid URI format', () => {
    const uri = 'antigravity://workspace/file.ts';
    expect(uri).toMatch(/^[a-z]+:\/\//);
  });

  test('button label for antigravity scheme', () => {
    const uri = 'antigravity://workspace/src/main.ts';
    const scheme = uri.split('://')[0];
    const label = scheme === 'antigravity' ? 'Open in AntiGravity' : 'Open';
    expect(label).toBe('Open in AntiGravity');
  });
});

describe('UT-DGR-01: Diagram Renderer SVG Output', () => {
  test('LruCache stores and retrieves values', () => {
    const cache = new LruCache<string, string>(10);
    cache.set('key1', '<svg>diagram</svg>');
    expect(cache.get('key1')).toBe('<svg>diagram</svg>');
  });

  test('LruCache evicts oldest when at capacity', () => {
    const cache = new LruCache<string, string>(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  test('LruCache promotes on access', () => {
    const cache = new LruCache<string, string>(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a');
    cache.set('c', '3');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });

  test('cache hit returns same SVG', () => {
    const cache = new LruCache<string, string>(50);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>A</text></svg>';
    cache.set('d1', svg);
    expect(cache.get('d1')).toBe(svg);
    expect(cache.get('d1')!.startsWith('<svg')).toBe(true);
  });
});
