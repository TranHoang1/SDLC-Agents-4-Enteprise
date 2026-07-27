export interface ShapeNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface Connector {
  id: string;
  fromShapeId: string;
  toShapeId: string;
  condition?: string;
  label?: string;
  isDefault: boolean;
}

export class PegaFlowGraph {
  constructor(
    public readonly shapes: Map<string, ShapeNode>,
    public readonly connectors: Connector[],
  ) {}

  getShape(id: string): ShapeNode | undefined {
    return this.shapes.get(id);
  }

  getOutgoingConnectors(shapeId: string): Connector[] {
    return this.connectors.filter(c => c.fromShapeId === shapeId);
  }

  getIncomingConnectors(shapeId: string): Connector[] {
    return this.connectors.filter(c => c.toShapeId === shapeId);
  }

  getStartShape(): ShapeNode | undefined {
    for (const [, shape] of this.shapes) {
      if (shape.type === 'Start' || shape.properties.pyShapeType === 'Start') {
        return shape;
      }
    }
    return undefined;
  }

  getEndShapes(): ShapeNode[] {
    const ends: ShapeNode[] = [];
    for (const [, shape] of this.shapes) {
      if (shape.type === 'End' || shape.properties.pyShapeType === 'End') {
        ends.push(shape);
      }
    }
    return ends;
  }
}
