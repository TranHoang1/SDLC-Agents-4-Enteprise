export interface AstReference {
  ruleType: string;
  className: string;
  ruleName: string;
  role: string;
}

export interface AstNode {
  type: string;
  properties: Record<string, unknown>;
  children: AstNode[];
}

export interface PegaRuleAst {
  astVersion: '1.0';
  ruleType: string;
  name: string;
  className: string;
  ruleset?: string;
  rulesetVersion?: string;
  label?: string;
  description?: string;
  properties: Record<string, unknown>;
  children: AstNode[];
  references: AstReference[];
}

export const SYSTEM_FIELD_PREFIXES = [
  'pxCreate', 'pxUpdate', 'pxInstance', 'pxHost', 'pxMove', 'pxSibling',
  'pxLimitedAccess', 'pzChecksum', 'pzIndex', 'pzReindex', 'pzOriginal',
  'pxAllChangeList', 'pxWarnings', 'pxNamedPageReferences', 'pxAPIMethodReferences',
  'pyCircumstanceDate', 'pyCircumstanceProp', 'pyCircumstanceType',
  'pyCircumstanceVal', 'pyDateRangeRuleResolution', 'pyAllowLocking',
  'pyAdminProduct', 'pyAdminProductVersion', 'pyAspect', 'pyBaseRule',
  'pyDeprecated', 'pyExcludeFromFTIndex', 'pyHasInstances', 'pyInsAvailable',
  'pyInitialVersion', 'pyJavaGenerator', 'pyJavaStream', 'pyJavaWrapperClassName',
  'pyMethodStatus', 'pyOrgDivision', 'pyPreventSubClassing',
  'pyQualifiedRuleResolution', 'pyRuleEnds', 'pyRuleStarts',
  'pySortDateCircumWithinRSMajor', 'pyStrategicProcessName', 'pyTemplateCheckbox',
  'pyTemplateDataField', 'pyTemplateInputBox', 'pyValueChanged',
  'pyWorkKey', 'pyLabelOld', 'pzRuleSetVersionMajor', 'pzRuleSetVersionMinor',
  'pzRuleSetVersionPatch', 'pyKeyDefList',
];

export const SYSTEM_FIELDS = new Set([
  'pxObjClass', 'pyClassName', 'pyRuleName', 'pyRuleset', 'pyRulesetVersion',
  'pyInsKey', 'pzInsKey', 'pxInsId', 'pxInsName',
  'pyRuleAvailable', 'pyModelName', 'pyActivityName',
  'pyTransformName', 'pyUserIdentifier', 'pyAccessGroup',
  'pyRuleSet', 'pyRuleSetVersion',
]);
