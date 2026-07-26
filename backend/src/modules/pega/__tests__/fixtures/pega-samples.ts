/**
 * Sample JSON fixtures for various Pega Rule & Data types.
 */

export const MOCK_ACTIVITY_JSON = {
  pxObjClass: 'Rule-Obj-Activity',
  pyClassName: 'Work-Cover-Jira',
  pyActivityName: 'ResolveTicket',
  pyRuleset: 'JiraIntegration',
  pyRulesetVersion: '01-02-03',
  pyLabel: 'Process and Resolve Jira Ticket',
  steps: [
    {
      pyStepNum: '1',
      pyMethod: 'Call',
      pyMethodParameters: 'Work-Cover-Jira.ValidateData',
      pyLabel: 'Validate Input Data',
    },
    {
      pyStepNum: '2',
      pyMethod: 'Call',
      pyMethodParameters: '@baseclass.SendNotification',
      pyLabel: 'Send Email Notification',
    },
  ],
};

export const MOCK_VALIDATE_DATA_ACTIVITY_JSON = {
  pxObjClass: 'Rule-Obj-Activity',
  pyClassName: 'Work-Cover-Jira',
  pyActivityName: 'ValidateData',
  pyRuleset: 'JiraIntegration',
  pyRulesetVersion: '01-02-03',
  pyLabel: 'Validate Data Activity',
  steps: [],
};

export const MOCK_DATA_TRANSFORM_JSON = {
  pxObjClass: 'Rule-Obj-Model',
  pyClassName: 'Work-Cover-Jira',
  pyModelName: 'InitializeTicketData',
  pyRuleset: 'JiraIntegration',
  pyRulesetVersion: '01-02-03',
  pyActions: [
    {
      pyActionType: 'Apply Data Transform',
      pyTarget: 'SetDefaultStatus',
    },
  ],
};

export const MOCK_OPERATOR_DATA_JSON = {
  pxObjClass: 'Data-Admin-Operator-ID',
  pyUserIdentifier: 'lead.dev@company.com',
  pyUserName: 'Lead Developer',
  pyAccessGroup: 'JiraIntegration:Authors',
  pyUpdateDateTime: '2026-07-25T10:00:00.000Z',
};

export const MOCK_DECISION_TABLE_JSON = {
  pxObjClass: 'Rule-Declare-DecisionTable',
  pyClassName: 'Work-Cover-Jira',
  pyLabel: 'DeterminePriorityTable',
  pyRuleset: 'JiraIntegration',
  pyRulesetVersion: '01-02-03',
  pyPropertyEvaluated: 'pyPriority',
  pyReturnActions: [{ pyTransformName: 'SetHighPriorityData' }],
};
