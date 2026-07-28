import type { PegaMetaModelRegistry } from '../metamodel/PegaMetaModelRegistry.js';
import { PegaSchemaInferrer } from './PegaSchemaInferrer.js';

export interface FieldDocumentation {
  fieldName: string;
  type: string;
  description: string;
  sampleValues: string[];
  isReference: boolean;
  isRequired: boolean;
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  pyActivityName: 'Name of the Activity rule to call',
  pyClassName: 'Applies to class name',
  pyMethodParameters: 'Parameters passed to the method',
  pyLabel: 'Display label for the rule',
  pyDescription: 'Description of the rule',
  pyRuleset: 'Ruleset name',
  pyRulesetVersion: 'Ruleset version',
  pyModelName: 'Data Transform/Model name',
  pyRuleName: 'Rule name',
  pyUserIdentifier: 'User identifier (email or ID)',
  pyAccessGroup: 'Access group assignment',
  pyUpdateDateTime: 'Last update timestamp',
  pyUserName: 'User display name',
  pyPropertyEvaluated: 'Property being evaluated',
  pyReturnActions: 'Return actions for the decision table',
  pyTarget: 'Target property or transform',
  pySource: 'Source property or class',
  pyTransformName: 'Name of the data transform',
  pySuperClass: 'Parent class name',
  pyDerivesFrom: 'Base class this derives from',
  pyPatternParent: 'Pattern parent class reference',
  pyWhenCondition: 'When condition rule reference',
  pyOnChangeTrigger: 'On change trigger condition',
  pyFlowActionName: 'Flow action rule name',
  pyFlowName: 'Flow rule name',
  pyBlockName: 'Block or section name',
  pyPropertyName: 'Property name',
  pyAuthProfile: 'Authentication profile reference',
  pyRequestDataTransform: 'Request data transform reference',
  pyResponseDataTransform: 'Response data transform reference',
  pyServiceRuleName: 'Service rule name',
  pyServiceName: 'Service name',
  pyPagesAndClasses: 'Pages and classes referenced',
  pyValidRuleSets: 'Valid rulesets for the rule',
  pyLinks: 'Links to related rules',
  pyKeyDefList: 'Key definitions for the class',
  pxRuleReferences: 'References to other rules',
  pyActionType: 'Action type for the step',
  pyMethod: 'Method type for the activity step',
  pyStepNum: 'Step number in the activity',
  pyTargetClass: 'Target class for the connector',
  pyConnectorName: 'Connector name',
  pyConnectType: 'Connection type',
  pyURL: 'URL for the connector endpoint',
  pyHTTPMethod: 'HTTP method for REST connector',
  pyHeaders: 'HTTP headers for the connector',
  pyRequestBody: 'HTTP request body template',
  pxObjClass: 'Pega rule class type identifier',
  pyStatus: 'Current status of the rule or work item',
  pyUrgency: 'Urgency value for prioritization',
  pyGoal: 'Goal duration for service level agreement',
  pyDeadline: 'Deadline duration for service level agreement',
  pyAssignee: 'Assigned user or work group',
  pyOrganization: 'Organization unit reference',
  pyStage: 'Case stage reference',
  pyProcessName: 'Process name within a case',
  pySectionName: 'Section rule name',
  pyHarnessName: 'Harness rule name',
  pyLayoutType: 'Layout type for UI sections (dynamic, tab, etc.)',
  pyFlowType: 'Flow type (workflow, subprocess, etc.)',
  pyCaseTypeName: 'Case type rule name',
  pyReportName: 'Report definition name',
  pyPrecondition: 'Precondition expression for rules',
  pyCode: 'Source code content',
  pyLanguage: 'Programming language for utility rules',
  pyMessage: 'Message text',
  pySeverity: 'Severity level for alerts or errors',
  pyWeight: 'Weight value for decisioning components',
  pyRank: 'Rank value for sorting or prioritization',
  pyComponentType: 'Strategy component type (Segment, Filter, etc.)',
  pyOfferName: 'Offer rule name',
  pyPropositionName: 'Proposition rule name',
  pyStrategyName: 'Strategy rule name',
  pyRuleType: 'Rule type class name',
  pyAppliesToClass: 'Class that the rule applies to',
  pyCaseDefault: 'Default case type reference',
  pyAllowList: 'Allow list of permitted values',
  pyDenyList: 'Deny list of excluded values',
};

export class PegaFieldDocumentor {
  private inferrer: PegaSchemaInferrer;

  constructor(inferrer: PegaSchemaInferrer) {
    this.inferrer = inferrer;
  }

  public documentField(key: string, value: unknown, _allValues: Record<string, unknown>): FieldDocumentation {
    const type = this.inferValueType(value);
    const description = FIELD_DESCRIPTIONS[key] || `Field ${key} of type ${type}`;
    const sampleValues: string[] = [];

    if (value !== undefined && value !== null && value !== '') {
      sampleValues.push(String(value));
    }

    const isReference = this.inferrer.isReferenceField(key);
    const isRequired = key === 'pxObjClass' || key === 'pyClassName' || key === 'pyRuleName';

    return { fieldName: key, type, description, sampleValues, isReference, isRequired };
  }

  public documentClass(pxObjClass: string, json: Record<string, unknown>, _registry: PegaMetaModelRegistry): FieldDocumentation[] {
    const docs: FieldDocumentation[] = [];

    for (const [key, val] of Object.entries(json)) {
      if (key === 'pxAllChangeList' || key === 'pxWarnings' || key === 'pxAPIMethodReferences' || key === 'pxNamedPageReferences') continue;
      const doc = this.documentField(key, val, json);
      docs.push(doc);
    }

    return docs;
  }

  public generatePromptContext(pxObjClass: string, json: Record<string, unknown>, registry: PegaMetaModelRegistry): string {
    const lines: string[] = [];
    lines.push(`Rule Type: ${pxObjClass}`);
    lines.push('Fields:');

    const docs = this.documentClass(pxObjClass, json, registry);

    for (const doc of docs) {
      const typeInfo = doc.isReference ? 'ref' : doc.type;
      const requiredInfo = doc.isRequired ? 'required' : 'optional';
      const sampleInfo = doc.sampleValues.length > 0 ? ` (e.g., ${doc.sampleValues.join(', ')})` : '';
      lines.push(`  ${doc.fieldName} (${typeInfo}, ${requiredInfo})${sampleInfo} — ${doc.description}`);
    }

    return lines.join('\n');
  }

  private inferValueType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    return 'unknown';
  }
}
