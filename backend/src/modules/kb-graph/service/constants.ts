/**
 * Constants and interfaces for KB Graph service.
 */

export const LEVEL_MAP: Record<string, number> = {
  ARCHITECTURE: 0, REQUIREMENT: 0, DECISION: 0,
  PROCEDURE: 0, CONTEXT: 0, CODE_ENTITY: 0,
  LESSON_LEARNED: 1, ERROR_PATTERN: 1, DOCUMENT: 1,
  FUNCTION: 1, METHOD: 1, CLASS: 0, INTERFACE: 0,
  TYPE: 1, CONSTRUCTOR: 1, PROPERTY: 2, ENUM: 1,
};

export const KIND_TO_TYPE: Record<string, string> = {
  function: 'FUNCTION',
  method: 'METHOD',
  class: 'CLASS',
  interface: 'INTERFACE',
  type: 'TYPE',
  constructor: 'CONSTRUCTOR',
  property: 'PROPERTY',
  enum: 'ENUM',
  constant: 'CONSTANT',
  variable: 'VARIABLE',
  // Pega rule kinds → meaningful graph types
  pega_activity: 'ACTIVITY',
  pega_flow: 'FLOW',
  pega_flow_action: 'FLOW',
  pega_data_transform: 'DATA_TRANSFORM',
  pega_declare_expression: 'DECLARE_EXPRESSION',
  pega_report: 'REPORT',
  pega_section: 'SECTION',
  pega_harness: 'HARNESS',
  pega_property: 'PROPERTY',
  pega_class: 'PEGA_SCHEMA',
  pega_decision_table: 'DECISION',
  pega_decision_tree: 'DECISION',
  pega_map_value: 'DECISION',
  pega_when: 'DECISION',
  pega_validate: 'VALIDATE',
  pega_unknown: 'PEGA_RULE',
};

export interface SpatialQueryParams {
  camX: number;
  camY: number;
  camZ: number;
  zoom: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  tier: string;
  x: number;
  y: number;
  z: number;
  level: number;
  clusterId: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
}

export interface SpatialGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    queryTimeMs: number;
    level: string;
    totalInDb: number;
    totalEdgesInDb: number;
  };
}
