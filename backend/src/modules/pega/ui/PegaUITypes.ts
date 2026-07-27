export type LayoutType = 'dynamic' | 'tab' | 'repeating' | 'table';

export interface PegaField {
  name: string;
  label?: string;
  type?: string;
  value?: unknown;
  visible?: boolean;
  when?: string;
}

export interface PegaLayout {
  type?: LayoutType;
  fields?: PegaField[];
  children?: PegaLayout[];
  properties?: Record<string, unknown>;
  visible?: boolean;
  when?: string;
}

export interface PegaSection {
  name: string;
  layouts: PegaLayout[];
  fields: PegaField[];
  properties?: Record<string, unknown>;
}