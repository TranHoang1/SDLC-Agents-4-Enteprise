import type { PegaRuleAst } from '../PegaRuleAst.js';
import { PegaRuleAstParser } from '../PegaRuleAstParser.js';

export interface GoldenTestSample {
  name: string;
  pxObjClass: string;
  json: Record<string, unknown>;
  expectedReferences: string[];
  expectedSummary?: string;
  expectedChildren: number;
}

export interface VerificationResult {
  sampleName: string;
  passed: boolean;
  issues: string[];
  ast: PegaRuleAst;
}

export class PegaGoldenDataset {
  private parser = new PegaRuleAstParser();

  getActivitySample(): GoldenTestSample {
    return {
      name: 'ResolveTicket',
      pxObjClass: 'Rule-Obj-Activity',
      json: {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Cover-Jira',
        pyActivityName: 'ResolveTicket',
        pyRuleset: 'JiraIntegration',
        pyRuleSetVersion: '01-02-03',
        pyLabel: 'Process and Resolve Jira Ticket',
        pyDescription: 'Main resolution flow for Jira integration',
        pxCreateDateTime: '2024-01-01T00:00:00Z',
        pxCreateOperator: 'admin',
        steps: [
          { pyStepNum: '1', pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.ValidateData', pyLabel: 'Validate Input' },
          { pyStepNum: '2', pyMethod: 'Call', pyMethodParameters: '@baseclass.SendNotification', pyLabel: 'Send Email' },
          { pyStepNum: '3', pyMethod: 'Property-Set', pyMethodParameters: '.pyStatus', pyLabel: 'Set Status', pyStepContext: 'Primary' },
          { pyStepNum: '4', pyMethod: 'Branch', pyMethodParameters: 'Work-Cover-Jira.EscalateIfNeeded', pyLabel: 'Escalate', pyWhenCondition: 'NeedsEscalation' },
        ],
      },
      expectedReferences: ['ValidateData', 'SendNotification', 'EscalateIfNeeded', 'NeedsEscalation'],
      expectedChildren: 4,
    };
  }

  getDataTransformSample(): GoldenTestSample {
    return {
      name: 'InitializeTicket',
      pxObjClass: 'Rule-Obj-Model',
      json: {
        pxObjClass: 'Rule-Obj-Model',
        pyClassName: 'Work-Cover-Jira',
        pyModelName: 'InitializeTicket',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Initialize ticket data',
        pyActions: [
          { pyActionType: 'Set', pyTarget: '.pyStatus', pySource: 'New' },
          { pyActionType: 'Apply Data Transform', pyTarget: 'SetDefaultStatus' },
          { pyActionType: 'Set', pyTarget: '.pyPriority', pySource: '5', pyWhenCondition: 'IsHighPriority' },
          { pyActionType: 'Set', pyTarget: '.pyDescription', pySource: 'Default description' },
        ],
      },
      expectedReferences: ['SetDefaultStatus', 'IsHighPriority'],
      expectedChildren: 4,
    };
  }

  getFlowSample(): GoldenTestSample {
    return {
      name: 'MainProcess',
      pxObjClass: 'Rule-Obj-Flow',
      json: {
        pxObjClass: 'Rule-Obj-Flow',
        pyClassName: 'Work-Cover-Jira',
        pyFlowName: 'MainProcess',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Main Jira Process Flow',
        pyDescription: 'End-to-end Jira ticket processing flow',
        pyShapes: [
          { pyShapeType: 'Start', pyName: 'Begin' },
          { pyShapeType: 'Assignment', pyName: 'AssignTicket', pyFlowActionName: 'NewAssignment' },
          { pyShapeType: 'Action', pyName: 'Validate', pyFlowActionName: 'ValidateAction', pyWhenCondition: 'NeedsValidation' },
          { pyShapeType: 'Action', pyName: 'ProcessPayment', pyFlowActionName: 'PaymentAction', pyClassName: 'Work-Cover-Payment' },
          { pyShapeType: 'End', pyName: 'Done' },
        ],
      },
      expectedReferences: ['NewAssignment', 'ValidateAction', 'NeedsValidation', 'PaymentAction', 'Work-Cover-Payment'],
      expectedChildren: 5,
    };
  }

  getDecisionTableSample(): GoldenTestSample {
    return {
      name: 'PriorityDecision',
      pxObjClass: 'Rule-Declare-DecisionTable',
      json: {
        pxObjClass: 'Rule-Declare-DecisionTable',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'PriorityDecision',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Priority decision table',
        pyPropertyEvaluated: 'pyPriority',
        pyDecisionTableRows: [
          { pyCondition: 'pyUrgency > 80', pyResult: 'Critical' },
          { pyCondition: 'pyUrgency > 50', pyResult: 'High' },
          { pyCondition: 'pyUrgency > 20', pyResult: 'Medium' },
          { pyCondition: 'pyUrgency >= 0', pyResult: 'Low' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 4,
    };
  }

  getDecisionTreeSample(): GoldenTestSample {
    return {
      name: 'ApprovalTree',
      pxObjClass: 'Rule-Declare-DecisionTree',
      json: {
        pxObjClass: 'Rule-Declare-DecisionTree',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'ApprovalTree',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Approval decision tree',
        pyPropertyEvaluated: 'pyApprovalStatus',
        pyRows: [
          { pyCondition: 'pyAmount > 10000', pyResult: 'SeniorManager' },
          { pyCondition: 'pyAmount > 5000', pyResult: 'Manager' },
          { pyCondition: 'pyAmount > 0', pyResult: 'TeamLead' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 3,
    };
  }

  getWhenSample(): GoldenTestSample {
    return {
      name: 'IsHighPriority',
      pxObjClass: 'Rule-Obj-When',
      json: {
        pxObjClass: 'Rule-Obj-When',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'IsHighPriority',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Check if priority is high',
        pyWhenExpression: '.pyPriority = "Critical" .OR. .pyUrgency > 75',
        pyWhenType: 'Expression',
      },
      expectedReferences: [],
      expectedChildren: 0,
    };
  }

  getSectionSample(): GoldenTestSample {
    return {
      name: 'TicketDetails',
      pxObjClass: 'Rule-HTML-Section',
      json: {
        pxObjClass: 'Rule-HTML-Section',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'TicketDetails',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Jira ticket details section',
        pyDescription: 'Displays ticket details in a form layout',
        pzIndex: '0',
        pyLayouts: [
          { pyLayoutType: 'Dynamic', pyName: 'HeaderLayout' },
          { pyLayoutType: 'Grid', pyName: 'FieldsGrid' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 2,
    };
  }

  getConnectRestSample(): GoldenTestSample {
    return {
      name: 'GetJiraIssue',
      pxObjClass: 'Rule-Connect-REST',
      json: {
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'GetJiraIssue',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Get Jira issue details',
        pyBaseURL: 'https://jira.example.com/rest/api/2',
        pyResourcePath: '/issue/{issueId}',
        pyHTTPMethod: 'GET',
        pyHeaders: [
          { pyHeaderName: 'Authorization', pyHeaderValue: 'Bearer ${token}' },
          { pyHeaderName: 'Content-Type', pyHeaderValue: 'application/json' },
          { pyHeaderName: 'Accept', pyHeaderValue: 'application/json' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 3,
    };
  }

  getDeclareExpressionSample(): GoldenTestSample {
    return {
      name: 'TotalAmount',
      pxObjClass: 'Rule-Declare-Expressions',
      json: {
        pxObjClass: 'Rule-Declare-Expressions',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'TotalAmount',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Calculate total amount',
        pyTargetProperty: '.pyTotalAmount',
        pyExpression: '.pyQuantity * .pyUnitPrice',
        pyOnChangeTrigger: 'pyQuantity pyUnitPrice',
      },
      expectedReferences: ['pyQuantity pyUnitPrice'],
      expectedChildren: 0,
    };
  }

  getFlowActionSample(): GoldenTestSample {
    return {
      name: 'NewAssignment',
      pxObjClass: 'Rule-Obj-FlowAction',
      json: {
        pxObjClass: 'Rule-Obj-FlowAction',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'NewAssignment',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Create new assignment',
        pyDescription: 'Creates a new assignment in the workflow',
        pyPerformer: 'CurrentOperator',
        pyAssignmentType: 'Standard',
      },
      expectedReferences: [],
      expectedChildren: 0,
    };
  }

  getClassSample(): GoldenTestSample {
    return {
      name: 'Work-Cover-Jira',
      pxObjClass: 'Rule-Obj-Class',
      json: {
        pxObjClass: 'Rule-Obj-Class',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'Work-Cover-Jira',
        pySuperClass: 'Work-',
        pyPatternParent: 'Work-Cover-',
        pyDerivesFrom: 'Work-',
        pyDescription: 'Jira integration work class',
        pxRuleReferences: [
          { pxRuleObjClass: 'Rule-Obj-Property', pyRuleName: 'pyStatus', pxRuleClassName: 'Work-Cover-Jira' },
          { pxRuleObjClass: 'Rule-Obj-Property', pyRuleName: 'pyPriority', pxRuleClassName: 'Work-Cover-Jira' },
          { pxRuleObjClass: 'Rule-Obj-Property', pyRuleName: 'pyDescription', pxRuleClassName: 'Work-Cover-Jira' },
        ],
      },
      expectedReferences: ['Work-', 'Work-Cover-', 'pyStatus', 'pyPriority', 'pyDescription'],
      expectedChildren: 3,
    };
  }

  getDeclarePagesSample(): GoldenTestSample {
    return {
      name: 'TicketPages',
      pxObjClass: 'Rule-Declare-Pages',
      json: {
        pxObjClass: 'Rule-Declare-Pages',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'TicketPages',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Declare pages for ticket processing',
        pyPages: [
          { pyPageName: 'pyJiraResponse', pyPageClass: 'Data-Jira-Response' },
          { pyPageName: 'pyJiraConfig', pyPageClass: 'Data-Jira-Config' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 2,
    };
  }

  getUtilitySample(): GoldenTestSample {
    return {
      name: 'StringUtils',
      pxObjClass: 'Rule-Utility-Function',
      json: {
        pxObjClass: 'Rule-Utility-Function',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'StringUtils',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'String utility functions',
        pyParameters: [
          { pyParamName: 'input', pyParamType: 'Text' },
          { pyParamName: 'delimiter', pyParamType: 'Text' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 2,
    };
  }

  getConnectSOAPSample(): GoldenTestSample {
    return {
      name: 'GetCustomerData',
      pxObjClass: 'Rule-Connect-SOAP',
      json: {
        pxObjClass: 'Rule-Connect-SOAP',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'GetCustomerData',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Get customer data via SOAP',
        pyBaseURL: 'https://customer.example.com/soap/v1',
        pySOAPAction: 'GetCustomerInfo',
        pyHeaders: [
          { pyHeaderName: 'Authorization', pyHeaderValue: 'Basic ${creds}' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 1,
    };
  }

  getAccessRoleSample(): GoldenTestSample {
    return {
      name: 'JiraIntegrationRole',
      pxObjClass: 'Rule-Access-Role',
      json: {
        pxObjClass: 'Rule-Access-Role',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'JiraIntegrationRole',
        pyRuleset: 'JiraIntegration',
        pyLabel: 'Jira integration access role',
        pyOperations: [
          { pyOperation: 'Read', pyAccess: 'Allowed' },
          { pyOperation: 'Write', pyAccess: 'Allowed' },
          { pyOperation: 'Delete', pyAccess: 'Denied' },
        ],
      },
      expectedReferences: [],
      expectedChildren: 3,
    };
  }

  getAllSamples(): GoldenTestSample[] {
    return [
      this.getActivitySample(),
      this.getDataTransformSample(),
      this.getFlowSample(),
      this.getDecisionTableSample(),
      this.getDecisionTreeSample(),
      this.getWhenSample(),
      this.getSectionSample(),
      this.getConnectRestSample(),
      this.getDeclareExpressionSample(),
      this.getFlowActionSample(),
      this.getClassSample(),
      this.getDeclarePagesSample(),
      this.getUtilitySample(),
      this.getConnectSOAPSample(),
      this.getAccessRoleSample(),
    ];
  }

  verify(sample: GoldenTestSample, ast: PegaRuleAst): VerificationResult {
    const issues: string[] = [];

    if (ast.ruleType !== sample.pxObjClass) {
      issues.push(`Expected ruleType ${sample.pxObjClass}, got ${ast.ruleType}`);
    }

    if (ast.name !== sample.name) {
      issues.push(`Expected name ${sample.name}, got ${ast.name}`);
    }

    if (ast.children.length !== sample.expectedChildren) {
      issues.push(`Expected ${sample.expectedChildren} children, got ${ast.children.length}`);
    }

    for (const refName of sample.expectedReferences) {
      const found = ast.references.some(r => r.ruleName === refName);
      if (!found) {
        issues.push(`Expected reference ${refName} not found in AST`);
      }
    }

    return {
      sampleName: sample.name,
      passed: issues.length === 0,
      issues,
      ast,
    };
  }
}
