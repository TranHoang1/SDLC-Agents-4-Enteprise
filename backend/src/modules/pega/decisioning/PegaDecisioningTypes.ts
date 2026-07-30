import type { DecisionOperator } from '../decision/PegaEvaluationResult.js';

export interface Strategy {
  pyName: string;
  components: StrategyComponent[];
  pyDescription?: string;
  pyType: string;
}

export type ComponentType =
  | 'Segment'
  | 'Filter'
  | 'Rank'
  | 'SetPriority'
  | 'NBA'
  | 'Offer'
  | 'Proposition'
  | 'Treatment';

export interface StrategyComponent {
  pyName: string;
  pyComponentType: ComponentType;
  config: Record<string, unknown>;
}

export interface Condition {
  pyName: string;
  pyType: 'Segment' | 'Filter' | 'Eligibility';
  pyExpression?: string;
  pyWhen?: string;
  operator?: DecisionOperator;
  field?: string;
  value?: unknown;
}

export interface NBA {
  pyName: string;
  pyIssue?: string;
  pyGroup?: string;
  pyActive?: boolean;
  pyStartDate?: string;
  pyEndDate?: string;
  proposition?: Proposition;
  offer?: Offer;
}

export interface Offer {
  pyName: string;
  pyLabel?: string;
  pyIcon?: string;
  pyDescription?: string;
  pyTreatment?: string;
  pyDisplayOrder?: number;
  treatment?: Treatment;
}

export interface Proposition {
  pyName: string;
  pyGroup?: string;
  pyTreatment?: string;
  pyWeight?: number;
  pyStartDate?: string;
  pyEndDate?: string;
  offer?: Offer;
}

export interface Treatment {
  pyName: string;
  pyContent?: string;
  pyChannel?: string;
  pyDisplayFormat?: string;
}
