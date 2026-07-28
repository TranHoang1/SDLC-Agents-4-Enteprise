export interface SideEffect {
  type: 'api_call' | 'db_write' | 'page_update' | 'async' | 'email' | 'file';
  target: string;
  detail: string;
}

export interface SemanticDep {
  type: string;
  target: string;
  targetClass: string;
  context: string;
}

export interface ConditionSummary {
  field: string;
  operator: string;
  value: unknown;
  description: string;
}

export interface DataFlowEntry {
  input: string;
  transform: string;
  output: string;
}

export interface PropertyMapping {
  from: string;
  to: string;
  condition?: string;
}

export interface SemanticAnalysis {
  ruleType: string;
  name: string;
  className?: string;
  summary: string;
  intent: string;
  sideEffects: SideEffect[];
  dependencies: SemanticDep[];
  conditions: ConditionSummary[];
  dataFlow: DataFlowEntry[];
  steps?: number;
  calledActivities?: string[];
  setProperties?: string[];
  propertyMappings?: PropertyMapping[];
  shapeTypes?: string[];
  decisionRows?: number;
  propertyEvaluated?: string;
  renderedFields?: string[];
  layoutTypes?: string[];
  endpointUrl?: string;
  httpMethod?: string;
  authType?: string;
  targetProperty?: string;
  expression?: string;
}
