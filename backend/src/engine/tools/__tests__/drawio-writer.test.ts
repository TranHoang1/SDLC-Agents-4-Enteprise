/**
 * SA4E-84 — Unit tests for drawio-writer applyLayoutToXml (pure serialization).
 */

import { describe, it, expect } from 'vitest';
import { applyLayoutToXml } from '../drawio-writer.js';
import type { ElkNode, ElkEdge } from '../drawio-layout-models.js';

const RAW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="n1" value="A" style="rounded=1;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="n2" value="B" style="rounded=1;" vertex="1" parent="1">
  <mxGeometry x="240" y="40" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="e1" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="n1" target="n2">
  <mxGeometry relative="1" as="geometry"><Array as="points"/></mxGeometry>
</mxCell>
</root></mxGraphModel></diagram></mxfile>`;

function laidOutChildren(children: ElkNode[], edges: ElkEdge[] = []): ElkNode {
  const withEdges = children.map((c, i) => i === 0 ? { ...c, edges } : c);
  return { id: 'root', x: 0, y: 0, width: 0, height: 0, children: withEdges };
}

describe('applyLayoutToXml', () => {
  it('rewrites node geometry to laid-out coordinates', () => {
    const laidOut = laidOutChildren([
      { id: 'n1', x: 400, y: 100, width: 120, height: 60 },
      { id: 'n2', x: 600, y: 100, width: 120, height: 60 },
    ]);
    const { xml } = applyLayoutToXml(RAW_XML, laidOut);
    expect(xml).toContain('<mxGeometry x="400" y="100" width="120" height="60" as="geometry"/>');
    expect(xml).toContain('<mxGeometry x="600" y="100" width="120" height="60" as="geometry"/>');
  });

  it('reports repositioned nodes with old and new coordinates', () => {
    const laidOut = laidOutChildren([
      { id: 'n1', x: 400, y: 100, width: 120, height: 60 },
      { id: 'n2', x: 600, y: 100, width: 120, height: 60 },
    ]);
    const { repositionedNodes } = applyLayoutToXml(RAW_XML, laidOut);
    expect(repositionedNodes).toHaveLength(2);
    const n1 = repositionedNodes.find(r => r.id === 'n1')!;
    expect(n1).toEqual({ id: 'n1', x_old: 40, y_old: 40, x_new: 400, y_new: 100 });
  });

  it('normalizes negative coordinates to positive', () => {
    const laidOut = laidOutChildren([
      { id: 'n1', x: -20, y: -30, width: 120, height: 60 },
      { id: 'n2', x: -20, y: 130, width: 120, height: 60 },
    ]);
    const { xml, repositionedNodes } = applyLayoutToXml(RAW_XML, laidOut);
    expect(xml).toContain('<mxGeometry x="0" y="0"');
    expect(xml).toContain('<mxGeometry x="0" y="160"');
    const n1 = repositionedNodes.find(r => r.id === 'n1')!;
    expect(n1.x_new).toBe(0);
    expect(n1.y_new).toBe(0);
  });

  it('rounds coordinates to one decimal place', () => {
    const laidOut = laidOutChildren([
      { id: 'n1', x: 100.555, y: 0.123, width: 120, height: 60 },
    ]);
    const { xml } = applyLayoutToXml(RAW_XML, laidOut);
    expect(xml).toContain('<mxGeometry x="100.6" y="0.1"');
  });

  it('writes edge bend points into the Array as="points" section', () => {
    const edge: ElkEdge = {
      id: 'e1', sources: ['n1'], targets: ['n2'],
      sections: [{ bendPoints: [{ x: 300, y: 260 }, { x: 350, y: 260 }] }],
    };
    const laidOut = laidOutChildren([
      { id: 'n1', x: 400, y: 100, width: 120, height: 60 },
      { id: 'n2', x: 600, y: 100, width: 120, height: 60 },
    ], [edge]);
    const { xml } = applyLayoutToXml(RAW_XML, laidOut);
    expect(xml).toContain('<Array as="points"><mxPoint x="300" y="260"/><mxPoint x="350" y="260"/></Array>');
  });

  it('returns empty repositioned list when positions are unchanged', () => {
    const laidOut = laidOutChildren([
      { id: 'n1', x: 40, y: 40, width: 120, height: 60 },
      { id: 'n2', x: 240, y: 40, width: 120, height: 60 },
    ]);
    const { xml, repositionedNodes } = applyLayoutToXml(RAW_XML, laidOut);
    expect(repositionedNodes).toHaveLength(0);
    expect(xml).toBe(RAW_XML);
  });

  it('skips nodes absent from the source XML', () => {
    const laidOut = laidOutChildren([
      { id: 'n1', x: 400, y: 100, width: 120, height: 60 },
      { id: 'ghost', x: 50, y: 50, width: 120, height: 60 },
    ]);
    const { xml, repositionedNodes } = applyLayoutToXml(RAW_XML, laidOut);
    expect(xml).not.toContain('x="50" y="50"');
    expect(repositionedNodes.some(r => r.id === 'ghost')).toBe(false);
  });
});