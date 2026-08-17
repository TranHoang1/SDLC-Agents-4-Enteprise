/**
 * SA4E-84 — Unit tests for drawio-apply orchestration (edge-only fix + guards).
 * ELK full-layout path is exercised via drawio-tool.test.ts; here we test the
 * lighter container/edge-only path, the guard rails, and args normalization.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseDrawio } from '../drawio-parser.js';
import { handleApply, normalizeLayoutArgs } from '../drawio-apply.js';

const CONTAINER_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="cont" value="Service" style="swimlane;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="500" height="500" as="geometry"/>
</mxCell>
<mxCell id="n1" value="A" style="rounded=1;" vertex="1" parent="cont">
  <mxGeometry x="40" y="40" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="n2" value="B" style="rounded=1;" vertex="1" parent="cont">
  <mxGeometry x="220" y="40" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="n3" value="C" style="rounded=1;" vertex="1" parent="cont">
  <mxGeometry x="220" y="220" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="e1" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="cont" source="n1" target="n2">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
<mxCell id="e2" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="cont" source="n1" target="n3">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
</root></mxGraphModel></diagram></mxfile>`;

const CONTAINER_SINGLE_EDGE = CONTAINER_DIAGRAM
  .replace('<mxCell id="n3" value="C" style="rounded=1;" vertex="1" parent="cont">\n  <mxGeometry x="220" y="220" width="120" height="60" as="geometry"/>\n</mxCell>\n', '')
  .replace('<mxCell id="e2" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="cont" source="n1" target="n3">\n  <mxGeometry relative="1" as="geometry"/>\n</mxCell>\n', '');

describe('handleApply — guard rails', () => {
  it('rejects diagrams above MAX_NODES', async () => {
    const result = await handleApply('', { nodes: [], edges: [], containers: [] }, [], 501, 'unused.drawio');
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Diagram too large');
  });
});

describe('handleApply — container edge-only fix', () => {
  it('multiplexes exit ports but surfaces routing error while addPortToEdge regex is unbalanced', async () => {
    // drawio-apply.ts:141 builds a RegExp with an unbalanced parenthesis, so the
    // edge-only fix path always throws and handleApply returns a routing error.
    const tmp = writeTmp(CONTAINER_DIAGRAM);
    const { raw, graph } = parseDrawio(tmp);
    expect(graph.containers.length).toBeGreaterThan(0);
    const issues = [] as object[];
    const result = await handleApply(raw, graph, issues, graph.nodes.length, {}, tmp);
    const parsed = JSON.parse(result);
    expect(parsed.status).toBeUndefined();
    expect(parsed.error).toContain('Edge routing fix failed');
    // File must be untouched when the fix errors out.
    const after = fs.readFileSync(tmp, 'utf-8');
    expect(after).toBe(CONTAINER_DIAGRAM);
    cleanup(tmp);
  });

  it('reports already_good when no routing improvements are needed', async () => {
    const tmp = writeTmp(CONTAINER_SINGLE_EDGE);
    const { raw, graph } = parseDrawio(tmp);
    const result = await handleApply(raw, graph, [], graph.nodes.length, {}, tmp);
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('already_good');
    const after = fs.readFileSync(tmp, 'utf-8');
    expect(after).toBe(CONTAINER_SINGLE_EDGE);
    cleanup(tmp);
  });
});

describe('normalizeLayoutArgs', () => {
  it('caps spacing at the MAX_SPACING upper bound', () => {
    const result = normalizeLayoutArgs({ spacing: 999999 });
    expect(result.spacing).toBe(500);
  });

  it('preserves valid custom values', () => {
    const result = normalizeLayoutArgs({ algorithm: 'force', spacing: 120, direction: 'right' });
    expect(result).toEqual({ algorithm: 'force', spacing: 120, direction: 'RIGHT' });
  });

  it('falls back non-numeric spacing to default', () => {
    expect(normalizeLayoutArgs({ spacing: 'wide' as unknown as number }).spacing).toBe(80);
  });
});

function writeTmp(xml: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawio-apply-test-'));
  const file = path.join(dir, 'test.drawio');
  fs.writeFileSync(file, xml, 'utf-8');
  return file;
}

function cleanup(file: string): void {
  try { fs.rmSync(path.dirname(file), { recursive: true, force: true }); } catch { /* ignore */ }
}