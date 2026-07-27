import { describe, it, expect } from 'vitest';
import { PegaConnectParser } from '../../connect/PegaConnectParser.js';
import { PegaParserRegistry } from '../../strategies/PegaParserRegistry.js';
import { registerConnectParser } from '../../connect/index.js';

describe('PegaConnectParser', () => {
  const parser = new PegaConnectParser();

  describe('supports', () => {
    it('supports Rule-Connect-REST', () => {
      expect(parser.supports('Rule-Connect-REST')).toBe(true);
    });
    it('supports Rule-Connect-SOAP', () => {
      expect(parser.supports('Rule-Connect-SOAP')).toBe(true);
    });
    it('supports Rule-Connect-SQL', () => {
      expect(parser.supports('Rule-Connect-SQL')).toBe(true);
    });
    it('supports Rule-Connect-File', () => {
      expect(parser.supports('Rule-Connect-File')).toBe(true);
    });
    it('supports Rule-Service-REST', () => {
      expect(parser.supports('Rule-Service-REST')).toBe(true);
    });
    it('supports generic Rule-Connect- prefix', () => {
      expect(parser.supports('Rule-Connect-MQ')).toBe(true);
    });
    it('does not support unrelated rule types', () => {
      expect(parser.supports('Rule-Obj-Activity')).toBe(false);
      expect(parser.supports('Rule-Obj-Model')).toBe(false);
    });
  });

  describe('parseConnectRest', () => {
    it('parses Rule-Connect-REST with endpoint, method, auth, headers', () => {
      const json = {
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'GetJiraIssue',
        pyLabel: 'Get Jira Issue',
        pyBaseURL: 'https://jira.example.com/rest/api/2',
        pyResourcePath: '/issue/{issueId}',
        pyHTTPMethod: 'GET',
        pyAuthProfile: 'JiraOAuth',
        pyAuthType: 'oauth2',
        pyRequestDataTransform: 'MapJiraRequest',
        pyResponseDataTransform: 'ParseJiraResponse',
        pyHeaders: [
          { pyHeaderName: 'Authorization', pyHeaderValue: 'Bearer ${token}' },
          { pyHeaderName: 'Content-Type', pyHeaderValue: 'application/json' },
        ],
      };

      const rule = parser.parseConnectRest(json);
      expect(rule.connectType).toBe('REST');
      expect(rule.endpoint).toBe('https://jira.example.com/rest/api/2');
      expect(rule.method).toBe('GET');
      expect(rule.authType).toBe('oauth2');
      expect(rule.authRef).toBe('JiraOAuth');
      expect(rule.requestMapping).toBe('MapJiraRequest');
      expect(rule.responseMapping).toBe('ParseJiraResponse');
      expect(rule.headers).toHaveLength(2);
      expect(rule.headers![0].pyName).toBe('Authorization');
      expect(rule.headers![0].pyValue).toBe('Bearer ${token}');
      expect(rule.headers![1].pyName).toBe('Content-Type');
    });

    it('handles optional fields gracefully for REST', () => {
      const json = {
        pxObjClass: 'Rule-Connect-REST',
        pyRuleName: 'MinimalRest',
      };

      const rule = parser.parseConnectRest(json);
      expect(rule.endpoint).toBeUndefined();
      expect(rule.method).toBeUndefined();
      expect(rule.authRef).toBeUndefined();
      expect(rule.headers).toBeUndefined();
    });
  });

  describe('parseConnectSoap', () => {
    it('parses Rule-Connect-SOAP with WSDL URL, SOAP action', () => {
      const json = {
        pxObjClass: 'Rule-Connect-SOAP',
        pyRuleName: 'GetCustomerSoap',
        pyLabel: 'Get Customer via SOAP',
        pyWSDLURL: 'https://example.com/service?wsdl',
        pySoapAction: 'http://example.com/GetCustomer',
        pyEndpointURL: 'https://example.com/service',
        pyAuthProfile: 'BasicAuth',
        pyHeaders: [
          { pyHeaderName: 'SOAPAction', pyHeaderValue: 'http://example.com/GetCustomer' },
        ],
      };

      const rule = parser.parseConnectSoap(json);
      expect(rule.connectType).toBe('SOAP');
      expect(rule.wsdlUrl).toBe('https://example.com/service?wsdl');
      expect(rule.soapAction).toBe('http://example.com/GetCustomer');
      expect(rule.endpoint).toBe('https://example.com/service');
      expect(rule.authRef).toBe('BasicAuth');
      expect(rule.headers).toHaveLength(1);
    });
  });

  describe('parseConnectSql', () => {
    it('parses Rule-Connect-SQL with datasource, statement', () => {
      const json = {
        pxObjClass: 'Rule-Connect-SQL',
        pyRuleName: 'GetOpenTickets',
        pyDataSource: 'JiraDB',
        pySQLStatement: 'SELECT * FROM TICKETS WHERE STATUS = ?',
        pyRWAccess: 'JiraDB',
      };

      const rule = parser.parseConnectSql(json);
      expect(rule.connectType).toBe('SQL');
      expect(rule.dataSource).toBe('JiraDB');
      expect(rule.sqlStatement).toBe('SELECT * FROM TICKETS WHERE STATUS = ?');
    });
  });

  describe('parseConnectFile', () => {
    it('parses Rule-Connect-File with file path, pattern', () => {
      const json = {
        pxObjClass: 'Rule-Connect-File',
        pyRuleName: 'WriteOutputFile',
        pyFilePath: '/data/output/report.csv',
        pyFilePattern: '*.csv',
      };

      const rule = parser.parseConnectFile(json);
      expect(rule.connectType).toBe('File');
      expect(rule.filePath).toBe('/data/output/report.csv');
      expect(rule.filePattern).toBe('*.csv');
    });
  });

  describe('parseServiceRule', () => {
    it('parses Rule-Service-REST with allowed methods', () => {
      const json = {
        pxObjClass: 'Rule-Service-REST',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'JiraWebhookService',
        pyServiceType: 'REST',
        pyEndpointURL: '/api/jira/webhook',
        pyHttpMethod: 'POST',
      };

      const service = parser.parseServiceRule(json);
      expect(service.serviceType).toBe('REST');
      expect(service.endpoint).toBe('/api/jira/webhook');
      expect(service.allowedMethods).toEqual(['POST']);
    });

    it('parses service with multiple allowed methods', () => {
      const json = {
        pxObjClass: 'Rule-Service-REST',
        pyRuleName: 'MultiMethodService',
        pyEndpointURL: '/api/data',
        pyHttpMethod: 'GET,POST,PUT',
      };

      const service = parser.parseServiceRule(json);
      expect(service.allowedMethods).toEqual(['GET', 'POST', 'PUT']);
    });
  });

  describe('parse (strategy interface)', () => {
    it('returns symbol and dependencies for Rule-Connect-REST', () => {
      const json = {
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'GetJiraIssue',
        pyRuleset: 'JiraIntegration',
        pyRulesetVersion: '01-02-03',
        pyEndpointURL: 'https://jira.example.com/rest/api/2',
        pyAuthProfile: 'JiraOAuth',
        pyRequestDataTransform: 'MapJiraRequest',
        pyResponseDataTransform: 'ParseJiraResponse',
      };

      const result = parser.parse(json);
      expect(result.symbol.fqn).toBe('Rule-Connect-REST:Work-Cover-Jira:GetJiraIssue');
      expect(result.symbol.name).toBe('GetJiraIssue');
      expect(result.symbol.ruleType).toBe('Rule-Connect-REST');
      expect(result.symbol.isRule).toBe(true);
      expect(result.symbol.ruleset).toBe('JiraIntegration');

      expect(result.dependencies).toHaveLength(3);
      expect(result.dependencies).toContainEqual({ ruleType: 'Rule-Connect-AuthProfile', className: '@baseclass', ruleName: 'JiraOAuth' });
      expect(result.dependencies).toContainEqual({ ruleType: 'Rule-Obj-Model', className: 'Work-Cover-Jira', ruleName: 'MapJiraRequest' });
      expect(result.dependencies).toContainEqual({ ruleType: 'Rule-Obj-Model', className: 'Work-Cover-Jira', ruleName: 'ParseJiraResponse' });
    });

    it('extracts reference fields from Rule-Connect-SOAP', () => {
      const json = {
        pxObjClass: 'Rule-Connect-SOAP',
        pyClassName: 'Work-Cover-Jira',
        pyRuleName: 'SoapService',
        pyWSDLURL: 'https://example.com/service?wsdl',
        pyAuthProfile: 'WsSecurity',
      };

      const result = parser.parse(json);
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]).toEqual({ ruleType: 'Rule-Connect-AuthProfile', className: '@baseclass', ruleName: 'WsSecurity' });
    });
  });

  describe('serialization round-trip', () => {
    it('supports round-trip: parse -> PegaConnectRule -> same fields', () => {
      const original = {
        pxObjClass: 'Rule-Connect-REST',
        pyRuleName: 'RoundTripTest',
        pyLabel: 'Round Trip Test',
        pyBaseURL: 'https://api.example.com/v1',
        pyHTTPMethod: 'POST',
        pyAuthProfile: 'ApiKeyAuth',
        pyAuthType: 'apiKey',
        pyRequestDataTransform: 'BuildPayload',
        pyHeaders: [
          { pyHeaderName: 'X-API-Key', pyHeaderValue: '${apiKey}' },
        ],
      };

      const rule = parser.parseConnectRest(original);
      expect(rule.pyName).toBe('RoundTripTest');
      expect(rule.connectType).toBe('REST');
      expect(rule.endpoint).toBe('https://api.example.com/v1');
      expect(rule.method).toBe('POST');
      expect(rule.authRef).toBe('ApiKeyAuth');
      expect(rule.authType).toBe('apiKey');
      expect(rule.requestMapping).toBe('BuildPayload');
      expect(rule.headers).toHaveLength(1);
      expect(rule.headers![0].pyName).toBe('X-API-Key');
      expect(rule.headers![0].pyValue).toBe('${apiKey}');
    });
  });

  describe('empty / missing fields', () => {
    it('handles empty headers array', () => {
      const json = {
        pxObjClass: 'Rule-Connect-REST',
        pyRuleName: 'NoHeaders',
        pyHeaders: [],
      };

      const rule = parser.parseConnectRest(json);
      expect(rule.headers).toBeUndefined();
    });

    it('handles null or missing pyHeaders', () => {
      const json = {
        pxObjClass: 'Rule-Connect-REST',
        pyRuleName: 'NoHeadersAtAll',
      };

      const rule = parser.parseConnectRest(json);
      expect(rule.headers).toBeUndefined();
    });
  });

  describe('registry integration', () => {
    it('registers via PegaParserRegistry', () => {
      const registry = new PegaParserRegistry();
      const registered = registerConnectParser(registry);
      expect(registered).toBeInstanceOf(PegaConnectParser);

      const result = registry.parse({
        pxObjClass: 'Rule-Connect-REST',
        pyClassName: 'Work-Cover',
        pyRuleName: 'RegistryTest',
      });

      expect(result.symbol.ruleType).toBe('Rule-Connect-REST');
      expect(result.symbol.name).toBe('RegistryTest');
    });
  });
});