import { describe, it, expect } from 'vitest';
import { PegaFlowGraph } from '../../workflow/PegaFlowGraph.js';
import type { ShapeNode, Connector } from '../../workflow/PegaFlowGraph.js';
import { PegaFlowGraphBuilder } from '../../workflow/PegaFlowGraphBuilder.js';
import { PegaWorkItem } from '../../workflow/PegaWorkItem.js';
import { PegaWorkflowEngine } from '../../workflow/PegaWorkflowEngine.js';
import { PegaClipboardContext } from '../../expression/PegaClipboardContext.js';

describe('PegaFlowGraph', () => {
  it('getShape returns shape by id', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'Start', properties: {} });
    const graph = new PegaFlowGraph(shapes, []);
    expect(graph.getShape('s1')).toBeDefined();
    expect(graph.getShape('s1')!.id).toBe('s1');
    expect(graph.getShape('s1')!.type).toBe('Start');
  });

  it('getShape returns undefined for missing shape', () => {
    const graph = new PegaFlowGraph(new Map(), []);
    expect(graph.getShape('nonexistent')).toBeUndefined();
  });

  it('getStartShape finds shape by type Start', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'Start', properties: {} });
    shapes.set('s2', { id: 's2', type: 'Action', properties: {} });
    shapes.set('s3', { id: 's3', type: 'End', properties: {} });
    const graph = new PegaFlowGraph(shapes, []);
    const start = graph.getStartShape();
    expect(start).toBeDefined();
    expect(start!.id).toBe('s1');
  });

  it('getStartShape returns undefined when no Start shape exists', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'Action', properties: {} });
    const graph = new PegaFlowGraph(shapes, []);
    expect(graph.getStartShape()).toBeUndefined();
  });

  it('getStartShape finds shape by pyShapeType property Start', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'SomeType', properties: { pyShapeType: 'Start' } });
    const graph = new PegaFlowGraph(shapes, []);
    const start = graph.getStartShape();
    expect(start).toBeDefined();
    expect(start!.id).toBe('s1');
  });

  it('getEndShapes returns shapes with type End', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'Start', properties: {} });
    shapes.set('s2', { id: 's2', type: 'End', properties: {} });
    shapes.set('s3', { id: 's3', type: 'End', properties: {} });
    const graph = new PegaFlowGraph(shapes, []);
    const ends = graph.getEndShapes();
    expect(ends).toHaveLength(2);
    expect(ends.map(e => e.id)).toEqual(['s2', 's3']);
  });

  it('getEndShapes returns empty array when no End shapes exist', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'Start', properties: {} });
    const graph = new PegaFlowGraph(shapes, []);
    expect(graph.getEndShapes()).toHaveLength(0);
  });

  it('getOutgoingConnectors returns connectors from a shape', () => {
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 's1', toShapeId: 's2', isDefault: false },
      { id: 'c2', fromShapeId: 's1', toShapeId: 's3', isDefault: true },
      { id: 'c3', fromShapeId: 's2', toShapeId: 's3', isDefault: false },
    ];
    const graph = new PegaFlowGraph(new Map(), connectors);
    const outgoing = graph.getOutgoingConnectors('s1');
    expect(outgoing).toHaveLength(2);
    expect(outgoing.map(c => c.id)).toEqual(['c1', 'c2']);
  });

  it('getOutgoingConnectors returns empty for shape with no outgoing', () => {
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 's1', toShapeId: 's2', isDefault: false },
    ];
    const graph = new PegaFlowGraph(new Map(), connectors);
    expect(graph.getOutgoingConnectors('s2')).toHaveLength(0);
  });

  it('getIncomingConnectors returns connectors to a shape', () => {
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 's1', toShapeId: 's3', isDefault: false },
      { id: 'c2', fromShapeId: 's2', toShapeId: 's3', isDefault: true },
    ];
    const graph = new PegaFlowGraph(new Map(), connectors);
    const incoming = graph.getIncomingConnectors('s3');
    expect(incoming).toHaveLength(2);
    expect(incoming.map(c => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('PegaFlowGraphBuilder', () => {
  it('builds graph from valid shapes and connectors JSON with pyID fields', () => {
    const shapes = [
      { pyID: 'start', pyShapeType: 'Start', pyLabel: 'Begin' },
      { pyID: 'act1', pyShapeType: 'Action', pyLabel: 'Step 1' },
      { pyID: 'end', pyShapeType: 'End', pyLabel: 'Finish' },
    ];
    const connectors = [
      { pyID: 'c1', pyFromShape: 'start', pyToShape: 'act1', pyIsDefault: true },
      { pyID: 'c2', pyFromShape: 'act1', pyToShape: 'end', pyIsDefault: true },
    ];
    const builder = new PegaFlowGraphBuilder();
    const graph = builder.build(shapes, connectors);
    expect(graph.getShape('start')).toBeDefined();
    expect(graph.getShape('start')!.type).toBe('Start');
    expect(graph.getShape('act1')).toBeDefined();
    expect(graph.getShape('act1')!.type).toBe('Action');
    expect(graph.getShape('end')).toBeDefined();
    expect(graph.getShape('end')!.type).toBe('End');
    expect(graph.getOutgoingConnectors('start')).toHaveLength(1);
    expect(graph.getOutgoingConnectors('start')[0].toShapeId).toBe('act1');
    expect(graph.getOutgoingConnectors('act1')[0].toShapeId).toBe('end');
  });

  it('builds graph with alternate field names (id, type, fromShapeId, toShapeId)', () => {
    const shapes = [
      { id: 's1', type: 'Start' },
      { id: 's2', type: 'Action' },
      { id: 's3', type: 'End' },
    ];
    const connectors = [
      { id: 'c1', fromShapeId: 's1', toShapeId: 's2', isDefault: true },
      { id: 'c2', fromShapeId: 's2', toShapeId: 's3', isDefault: true },
    ];
    const builder = new PegaFlowGraphBuilder();
    const graph = builder.build(shapes, connectors);
    expect(graph.getShape('s1')).toBeDefined();
    expect(graph.getShape('s2')).toBeDefined();
    expect(graph.getShape('s3')).toBeDefined();
    expect(graph.getOutgoingConnectors('s1')[0].toShapeId).toBe('s2');
  });

  it('handles empty shapes and connectors arrays', () => {
    const builder = new PegaFlowGraphBuilder();
    const graph = builder.build([], []);
    expect(graph.getStartShape()).toBeUndefined();
    expect(graph.getEndShapes()).toHaveLength(0);
    expect(graph.getOutgoingConnectors('s1')).toHaveLength(0);
  });

  it('assigns default id when shape has no pyID or id field', () => {
    const shapes = [{ type: 'Start' }, { type: 'Action' }];
    const builder = new PegaFlowGraphBuilder();
    const graph = builder.build(shapes, []);
    expect(graph.getShape('shape_0')).toBeDefined();
    expect(graph.getShape('shape_0')!.type).toBe('Start');
    expect(graph.getShape('shape_1')).toBeDefined();
    expect(graph.getShape('shape_1')!.type).toBe('Action');
  });
});

describe('PegaWorkItem', () => {
  it('creates with Active state by default', () => {
    const item = new PegaWorkItem('WI-001');
    expect(item.id).toBe('WI-001');
    expect(item.state).toBe('Active');
    expect(item.currentShapeId).toBeNull();
    expect(item.history).toHaveLength(0);
    expect(item.assignments).toHaveLength(0);
    expect(item.slaData).toEqual({});
  });

  it('creates with Pending state and current shape id', () => {
    const item = new PegaWorkItem('WI-002', 'Pending', 'shape-1');
    expect(item.id).toBe('WI-002');
    expect(item.state).toBe('Pending');
    expect(item.currentShapeId).toBe('shape-1');
  });

  it('creates with Cancelled state', () => {
    const item = new PegaWorkItem('WI-003', 'Cancelled');
    expect(item.state).toBe('Cancelled');
  });

  it('creates with Resolved state', () => {
    const item = new PegaWorkItem('WI-004', 'Resolved');
    expect(item.state).toBe('Resolved');
  });

  it('addHistory records a history entry', () => {
    const item = new PegaWorkItem('WI-005', 'Active', 'shape-1');
    item.addHistory('shape-1', 'Start', 'enter', 'ok');
    expect(item.history).toHaveLength(1);
    const entry = item.history[0];
    expect(entry.shapeId).toBe('shape-1');
    expect(entry.shapeType).toBe('Start');
    expect(entry.action).toBe('enter');
    expect(entry.result).toBe('ok');
    expect(entry.timestamp).toBeDefined();
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
  });

  it('addHistory appends multiple entries in order', () => {
    const item = new PegaWorkItem('WI-006', 'Active', 's1');
    item.addHistory('s1', 'Start', 'enter', 'ok');
    item.addHistory('s2', 'Action', 'process', 'completed');
    item.addHistory('s3', 'End', 'exit', 'finished');
    expect(item.history).toHaveLength(3);
    expect(item.history[0].shapeId).toBe('s1');
    expect(item.history[1].shapeId).toBe('s2');
    expect(item.history[2].shapeId).toBe('s3');
  });

  it('supports assignment tracking', () => {
    const item = new PegaWorkItem('WI-007');
    item.assignments.push({ actor: 'user1', deadline: '2026-08-01' });
    item.assignments.push({ actor: 'user2' });
    expect(item.assignments).toHaveLength(2);
    expect(item.assignments[0].actor).toBe('user1');
    expect(item.assignments[0].deadline).toBe('2026-08-01');
    expect(item.assignments[1].actor).toBe('user2');
  });

  it('tracks slaData as a dictionary', () => {
    const item = new PegaWorkItem('WI-008');
    item.slaData = { created: '2026-07-27T10:00:00Z', paused: null, breached: false };
    expect(item.slaData.created).toBe('2026-07-27T10:00:00Z');
    expect(item.slaData.breached).toBe(false);
  });
});

describe('PegaWorkflowEngine', () => {
  it('simulates a simple linear flow Start -> Action -> End', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('start', { id: 'start', type: 'Start', properties: {} });
    shapes.set('action', { id: 'action', type: 'Action', properties: {} });
    shapes.set('end', { id: 'end', type: 'End', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'start', toShapeId: 'action', isDefault: true },
      { id: 'c2', fromShapeId: 'action', toShapeId: 'end', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(true);
    expect(result.currentNodeId).toBe('end');
    expect(result.history).toEqual(['start', 'action', 'end']);
    expect(result.log).toHaveLength(4);
    expect(result.log[0]).toContain('Start');
    expect(result.log[1]).toContain('Action');
    expect(result.log[2]).toContain('End');
    expect(result.log[3]).toContain('Reached END');
  });

  it('returns completed=true and stops at the first End shape reached', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('start', { id: 'start', type: 'Start', properties: {} });
    shapes.set('mid', { id: 'mid', type: 'Action', properties: {} });
    shapes.set('end1', { id: 'end1', type: 'End', properties: {} });
    shapes.set('end2', { id: 'end2', type: 'End', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'start', toShapeId: 'mid', isDefault: true },
      { id: 'c2', fromShapeId: 'mid', toShapeId: 'end1', isDefault: true },
      { id: 'c3', fromShapeId: 'end1', toShapeId: 'end2', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(true);
    expect(result.currentNodeId).toBe('end1');
    expect(result.history).toEqual(['start', 'mid', 'end1']);
  });

  it('returns completed=false when the graph has no Start shape', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('a1', { id: 'a1', type: 'Action', properties: {} });
    shapes.set('e1', { id: 'e1', type: 'End', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'a1', toShapeId: 'e1', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(false);
    expect(result.currentNodeId).toBe('');
  });

  it('stops and logs when a shape referenced by a connector is not in the graph', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('start', { id: 'start', type: 'Start', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'start', toShapeId: 'missing', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(false);
    expect(result.currentNodeId).toBe('missing');
    expect(result.log.some(l => l.includes('not found'))).toBe(true);
  });

  it('stops when a shape has no outgoing connectors (dead end without End type)', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('start', { id: 'start', type: 'Start', properties: {} });
    shapes.set('dead', { id: 'dead', type: 'Action', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'start', toShapeId: 'dead', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(false);
    expect(result.currentNodeId).toBe('dead');
  });

  it('starts from a specific shape when startShapeId is provided', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('s1', { id: 's1', type: 'Start', properties: {} });
    shapes.set('s2', { id: 's2', type: 'Action', properties: {} });
    shapes.set('s3', { id: 's3', type: 'End', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 's1', toShapeId: 's2', isDefault: true },
      { id: 'c2', fromShapeId: 's2', toShapeId: 's3', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context, 's2');
    expect(result.history[0]).toBe('s2');
    expect(result.history).toEqual(['s2', 's3']);
    expect(result.completed).toBe(true);
  });

  it('detects loops by exhausting the max step limit (50 steps)', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('start', { id: 'start', type: 'Start', properties: {} });
    shapes.set('loop', { id: 'loop', type: 'Action', properties: {} });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'start', toShapeId: 'loop', isDefault: true },
      { id: 'c2', fromShapeId: 'loop', toShapeId: 'loop', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(false);
    expect(result.history).toHaveLength(50);
  });

  it('handles flow where End shape is identified via pyShapeType property', () => {
    const shapes = new Map<string, ShapeNode>();
    shapes.set('start', { id: 'start', type: 'Start', properties: {} });
    shapes.set('end', { id: 'end', type: 'CustomEnd', properties: { pyShapeType: 'End' } });
    const connectors: Connector[] = [
      { id: 'c1', fromShapeId: 'start', toShapeId: 'end', isDefault: true },
    ];
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(true);
    expect(result.currentNodeId).toBe('end');
    expect(result.log.some(l => l.includes('END'))).toBe(true);
  });

  it('simulates flow with multiple sequential actions before reaching end', () => {
    const shapeIds = ['start', 'a1', 'a2', 'a3', 'end'];
    const shapes = new Map<string, ShapeNode>(
      shapeIds.map(id => [id, { id, type: id === 'start' ? 'Start' : id === 'end' ? 'End' : 'Action', properties: {} }]),
    );
    const connectors: Connector[] = [];
    for (let i = 0; i < shapeIds.length - 1; i++) {
      connectors.push({ id: `c${i}`, fromShapeId: shapeIds[i], toShapeId: shapeIds[i + 1], isDefault: true });
    }
    const graph = new PegaFlowGraph(shapes, connectors);
    const engine = new PegaWorkflowEngine();
    const context = new PegaClipboardContext({ pyWorkPage: {} });
    const result = engine.simulate(graph, context);
    expect(result.completed).toBe(true);
    expect(result.history).toEqual(shapeIds);
    expect(result.currentNodeId).toBe('end');
  });
});
