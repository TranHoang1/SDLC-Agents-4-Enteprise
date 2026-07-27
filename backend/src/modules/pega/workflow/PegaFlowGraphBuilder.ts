import { PegaFlowGraph } from './PegaFlowGraph.js';
import type { ShapeNode, Connector } from './PegaFlowGraph.js';

export class PegaFlowGraphBuilder {
  build(shapesJson: Record<string, unknown>[], connectorsJson: Record<string, unknown>[]): PegaFlowGraph {
    const shapes = new Map<string, ShapeNode>();

    for (const s of shapesJson) {
      const id = (s.pyID as string) || (s.id as string) || `shape_${shapes.size}`;
      const type = (s.pyShapeType as string) || (s.type as string) || 'Unknown';
      shapes.set(id, { id, type, properties: s });
    }

    const connectors: Connector[] = [];
    for (const c of connectorsJson) {
      const id = (c.pyID as string) || (c.id as string) || `conn_${connectors.length}`;
      connectors.push({
        id,
        fromShapeId: (c.pyFromShape as string) || (c.fromShapeId as string) || '',
        toShapeId: (c.pyToShape as string) || (c.toShapeId as string) || '',
        condition: (c.pyCondition as string) || undefined,
        label: (c.pyLabel as string) || undefined,
        isDefault: (c.pyIsDefault as boolean) || (c.isDefault as boolean) || false,
      });
    }

    return new PegaFlowGraph(shapes, connectors);
  }
}
