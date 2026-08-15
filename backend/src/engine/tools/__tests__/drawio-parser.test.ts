/**
 * SA4E-84 — Unit tests for drawio-parser XML parsing into DiagramGraph.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseDrawio } from '../drawio-parser.js';

const SIMPLE_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
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
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
</root></mxGraphModel></diagram></mxfile>`;

const SWIMLANE_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="cont" value="Service" style="swimlane;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="400" height="300" as="geometry"/>
</mxCell>
<mxCell id="n1" value="A" style="rounded=1;" vertex="1" parent="cont">
  <mxGeometry x="20" y="20" width="120" height="60" as="geometry"/>
</mxCell>
</root></mxGraphModel></diagram></mxfile>`;

describe('parseDrawio', () => {
  it('returns raw XML content unchanged', () => {
    const { raw } = parseDrawio(writeXml(SIMPLE_DIAGRAM));
    expect(raw).toBe(SIMPLE_DIAGRAM);
  });

  it('parses nodes with geometry', () => {
    const { graph } = parseDrawio(writeXml(SIMPLE_DIAGRAM));
    expect(graph.nodes).toHaveLength(2);
    const n1 = graph.nodes.find(n => n.id === 'n1');
    expect(n1).toMatchObject({ x: 40, y: 40, width: 120, height: 60, parentId: '1' });
    expect(n1!.isContainer).toBe(false);
  });

  it('parses edges with source and target', () => {
    const { graph } = parseDrawio(writeXml(SIMPLE_DIAGRAM));
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      id: 'e1', sourceId: 'n1', targetId: 'n2',
      style: 'edgeStyle=orthogonalEdgeStyle;',
    });
  });

  it('skips root cells (id 0 and 1)', () => {
    const { graph } = parseDrawio(writeXml(SIMPLE_DIAGRAM));
    expect(graph.nodes.find(n => n.id === '0')).toBeUndefined();
    expect(graph.nodes.find(n => n.id === '1')).toBeUndefined();
  });

  it('skips vertex cells without geometry', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="nog" value="NO-GEOM" style="rounded=1;" vertex="1" parent="1"/>
</root></mxGraphModel></diagram></mxfile>`;
    const { graph } = parseDrawio(writeXml(xml));
    expect(graph.nodes.length).toBe(0);
  });

  it('skips edges missing source or target', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="e1" edge="1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;
    const { graph } = parseDrawio(writeXml(xml));
    expect(graph.edges.length).toBe(0);
  });

  it('detects swimlane cells as containers', () => {
    const { graph } = parseDrawio(writeXml(SWIMLANE_DIAGRAM));
    expect(graph.containers).toHaveLength(1);
    expect(graph.containers[0].id).toBe('cont');
    expect(nodesOrContainers(graph).find(n => n.id === 'n1')).toBeDefined();
  });

  it('detects containers via parent relationships (not style)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="box" value="Box" style="rounded=1;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="300" height="300" as="geometry"/>
</mxCell>
<mxCell id="c1" value="X" style="rounded=1;" vertex="1" parent="box">
  <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
</mxCell>
</root></mxGraphModel></diagram></mxfile>`;
    const { graph } = parseDrawio(writeXml(xml));
    expect(graph.containers.some(c => c.id === 'box')).toBe(true);
  });

  it('applies fillColor none + dashed container heuristic', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram name="Page-1" id="test">
<mxGraphModel><root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<mxCell id="box" value="" style="rounded=0;fillColor=none;dashed=1;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="200" height="200" as="geometry"/>
</mxCell>
</root></mxGraphModel></diagram></mxfile>`;
    const { graph } = parseDrawio(writeXml(xml));
    expect(graph.containers.some(c => c.id === 'box')).toBe(true);
  });

  it('handles CRLF and nested mxCell bodies', () => {
    const xml = SIMPLE_DIAGRAM.replace(/\n/g, '\r\n');
    const { graph } = parseDrawio(writeXml(xml));
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });
});

function nodesOrContainers(graph: { nodes: Array<{ id: string }>; containers: Array<{ id: string }> }): Array<{ id: string }> {
  return [...graph.nodes, ...graph.containers];
}

function writeXml(xml: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawio-parser-test-'));
  const file = path.join(dir, 'test.drawio');
  fs.writeFileSync(file, xml, 'utf-8');
  return file;
}