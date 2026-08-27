/**
 * SA4E-223 — ReDoS regression test for the shared markup root-tag regex (Pentest F-1).
 *
 * Proves that parsing a large, malformed Salesforce markup file (a ~500 KB document
 * consisting of a repeated unterminated root tag without a closing `>`) completes in
 * bounded time instead of hanging the CPU for 30–45 s (catastrophic backtracking).
 */
import { describe, it, expect } from 'vitest';
import VisualforceParser from '../visualforce-parser.js';
import AuraParser from '../aura-parser.js';
import { extractMarkupTopLevel } from '../salesforce-markup/shared.js';

const vfParser = new VisualforceParser(null, 'visualforce');
const auraParser = new AuraParser(null, 'aura');

/** Build a ~500 KB malformed document: repeated unterminated root tag, no closing `>`. */
function buildMalformedVf(sizeKb: number): string {
  const unit = '<apex:page controller="com.example.sforce.ctrl.BigController" ';
  const repeat = Math.ceil((sizeKb * 1024) / unit.length);
  return unit.repeat(repeat);
}

describe('salesforce-markup ReDoS (F-1)', () => {
  it('VF-REDoS: 500 KB malformed page parses well under 1s and does not hang', () => {
    const source = buildMalformedVf(500);
    expect(source.length).toBeGreaterThan(400_000);

    const start = performance.now();
    const result = vfParser.parse(source, 'force-app/main/default/pages/Broken.page');
    const elapsed = performance.now() - start;

    // No root tag can complete (no `>`), so no symbol should be extracted...
    expect(result.symbols).toEqual([]);
    expect(result.relationships).toEqual([]);
    // ...and it must finish fast (linear, not O(n^2)). Generous budget for CI.
    expect(elapsed).toBeLessThan(1000);
  });

  it('AURA-REDoS: 500 KB malformed component parses well under 1s', () => {
    const unit = '<aura:component controller="com.example.sforce.ctrl.HugeController" ';
    const source = unit.repeat(Math.ceil((500 * 1024) / unit.length));

    const start = performance.now();
    const result = auraParser.parse(source, 'force-app/main/default/aura/Broken/Broken.cmp');
    const elapsed = performance.now() - start;

    expect(result.symbols).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });

  it('REDoS-ATTR: long attribute region with no closing quote is bounded', () => {
    // Attribute region > MAX_ATTR but still unterminated — must not backtrack explosively.
    const source = '<apex:page ' + 'a'.repeat(50_000) + ' ';
    const start = performance.now();
    const { symbols } = extractMarkupTopLevel(source, 'x.page', {
      rootTags: ['apex:page'],
      signaturePrefix: 'VisualforcePage',
      modifiers: ['visualforce', 'page'],
    });
    const elapsed = performance.now() - start;
    expect(symbols).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });

  it('still extracts a valid root tag quickly (no false-negative regression)', () => {
    const source = '<apex:page controller="GoodCtrl" extensions="E1,E2">\n  body\n</apex:page>';
    const result = vfParser.parse(source, 'force-app/main/default/pages/Good.page');
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe('Good');
    expect(result.relationships.map(r => r.targetSymbol).sort()).toEqual(['E1', 'E2', 'GoodCtrl']);
  });
});
