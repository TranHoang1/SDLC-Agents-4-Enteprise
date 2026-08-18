// Data models for ELK layout integration
export interface LayoutOptions {
  algorithm: string;
  spacing: number;
  direction: string;
}

export interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
  layoutOptions?: Record<string, string | number>;
}

export interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
  sections?: Array<{ startPoint?: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }>; endPoint?: { x: number; y: number } }>;
}

export interface LayoutResult {
  nodes: ElkNode[];
  edges: ElkEdge[];
}

export interface RepositionedNode {
  id: string;
  x_old: number;
  y_old: number;
  x_new: number;
  y_new: number;
}

export interface Issue {
  type: 'node_overlap' | 'edge_crossing' | 'diagonal_edge';
  severity: 'high' | 'medium' | 'low';
  node_a?: string;
  node_b?: string;
  overlap_pct?: number;
  edge_id?: string;
  edge_source?: string;
  edge_target?: string;
  crosses_node?: string;
  fix_hint: string;
}

export type DrawioIssue = Issue;

export interface LayoutFixResult {
  status: 'fixed' | 'already_good' | 'needs_fix' | 'error';
  message: string;
  nodes: number;
  edges: number;
  issues: Issue[];
  content_base64?: string;
  repositioned_nodes?: RepositionedNode[];
}
