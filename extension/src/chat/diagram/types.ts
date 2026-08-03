/**
 * SA4E-85 — Diagram module types.
 * Interfaces and type definitions for diagram rendering.
 */

/** Supported diagram types */
export type DiagramType = 'plantuml' | 'bpmn' | 'cmmn' | 'drawio-xml';

/** Data block representing a diagram in a chat message */
export interface DiagramBlock {
  /** Unique identifier for this diagram instance */
  diagramId: string;
  /** Diagram language/format type */
  type: DiagramType;
  /** Raw diagram source code */
  source: string;
  /** Pre-rendered SVG (if available from cache or prior render) */
  renderedSvg?: string;
  /** Agent that produced this diagram */
  agentId: string;
}

/**
 * IDiagramRenderer — contract for diagram rendering implementations.
 * Strategy pattern: different renderers can be swapped (local JAR, remote, etc.).
 */
export interface IDiagramRenderer {
  /** Render diagram source to SVG string; undefined on failure */
  render(block: DiagramBlock): Promise<string | undefined>;
  /** Check if renderer supports given diagram type */
  supports(type: DiagramType): boolean;
  /** Clear render cache */
  clearCache(): void;
}
