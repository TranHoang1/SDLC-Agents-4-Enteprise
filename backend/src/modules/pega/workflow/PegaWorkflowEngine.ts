import { PegaFlowGraph } from './PegaFlowGraph.js';
import { PegaClipboardContext } from '../expression/PegaClipboardContext.js';

export interface WorkItemSimulationResult {
  completed: boolean;
  currentNodeId: string;
  history: string[];
  log: string[];
}

export class PegaWorkflowEngine {
  public simulate(
    graph: PegaFlowGraph,
    context: PegaClipboardContext,
    startShapeId?: string,
  ): WorkItemSimulationResult {
    const history: string[] = [];
    const log: string[] = [];

    const startNode = startShapeId ? graph.getShape(startShapeId) : graph.getStartShape();
    let currentId = startNode ? startNode.id : '';
    let steps = 0;
    const maxSteps = 50;

    while (currentId && steps < maxSteps) {
      steps++;
      history.push(currentId);
      const shape = graph.getShape(currentId);

      if (!shape) {
        log.push(`Shape ${currentId} not found in flow graph`);
        break;
      }

      log.push(`Visited node [${shape.type}] (${shape.id})`);

      if (shape.type === 'End' || shape.properties.pyShapeType === 'End') {
        log.push(`Reached END shape ${shape.id}`);
        return { completed: true, currentNodeId: currentId, history, log };
      }

      const outgoing = graph.getOutgoingConnectors(currentId);
      if (outgoing.length === 0) {
        break;
      }

      currentId = outgoing[0].toShapeId;
    }

    return { completed: false, currentNodeId: currentId, history, log };
  }
}
