import type { IPegaRuleParserStrategy, ParseResult } from '../strategies/IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import type { PegaConnectRule, PegaConnectHeader, PegaServiceRule, ConnectMethod, ConnectType } from './PegaConnectTypes.js';

const CONNECT_CLASSES = new Set([
  'Rule-Connect-REST',
  'Rule-Connect-SOAP',
  'Rule-Connect-SQL',
  'Rule-Connect-File',
  'Rule-Connect-HTTP',
  'Rule-Connect-MQ',
  'Rule-Connect-JMS',
  'Rule-Connect-JCA',
  'Rule-Connect-Java',
  'Rule-Connect-EJB',
  'Rule-Connect-dotNet',
  'Rule-Connect-CMIS',
]);

export class PegaConnectParser implements IPegaRuleParserStrategy {
  public supports(pxObjClass: string): boolean {
    if (pxObjClass.startsWith('Rule-Service-')) return true;
    if (CONNECT_CLASSES.has(pxObjClass)) return true;
    if (pxObjClass.startsWith('Rule-Connect-')) return true;
    return false;
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || '';
    const className = (json.pyClassName as string) || '@baseclass';
    const name = this.extractName(pxObjClass, json);
    const fqn = `${pxObjClass}:${className}:${name}`;

    const dependencies = this.extractDependencies(json);

    const logicSummary = this.buildLogicSummary(pxObjClass, json);

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule: true,
      ruleset: (json.pyRuleset as string) || undefined,
      version: (json.pyRulesetVersion as string) || undefined,
      logicSummary,
    };

    return { symbol, dependencies };
  }

  private extractName(pxObjClass: string, json: Record<string, unknown>): string {
    return (json.pyRuleName as string)
      || (json.pyServiceRuleName as string)
      || (json.pyServiceName as string)
      || (json.pyLabel as string)
      || '';
  }

  public parseConnectRest(json: Record<string, unknown>): PegaConnectRule {
    const headers = this.parseHeaders(json);
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Connect-REST',
      pyName: this.extractName('Rule-Connect-REST', json),
      pyLabel: (json.pyLabel as string) || undefined,
      connectType: 'REST',
      endpoint: this.resolveEndpoint(json),
      method: this.resolveMethod(json),
      authType: this.resolveAuthType(json),
      authRef: (json.pyAuthProfile as string) || undefined,
      headers,
      requestMapping: (json.pyRequestDataTransform as string) || undefined,
      responseMapping: (json.pyResponseDataTransform as string) || undefined,
    };
  }

  public parseConnectSoap(json: Record<string, unknown>): PegaConnectRule {
    const headers = this.parseHeaders(json);
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Connect-SOAP',
      pyName: this.extractName('Rule-Connect-SOAP', json),
      pyLabel: (json.pyLabel as string) || undefined,
      connectType: 'SOAP',
      endpoint: this.resolveEndpoint(json),
      method: this.resolveMethod(json),
      authType: this.resolveAuthType(json),
      authRef: (json.pyAuthProfile as string) || undefined,
      headers,
      wsdlUrl: (json.pyWSDLURL as string) || (json.pyWsdlUrl as string) || undefined,
      soapAction: (json.pySoapAction as string) || (json.pySOAPAction as string) || undefined,
      requestMapping: (json.pyRequestDataTransform as string) || undefined,
      responseMapping: (json.pyResponseDataTransform as string) || undefined,
    };
  }

  public parseConnectSql(json: Record<string, unknown>): PegaConnectRule {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Connect-SQL',
      pyName: this.extractName('Rule-Connect-SQL', json),
      pyLabel: (json.pyLabel as string) || undefined,
      connectType: 'SQL',
      endpoint: (json.pyDataSource as string) || undefined,
      method: undefined,
      dataSource: (json.pyDataSource as string) || (json.pyRWAccess as string) || undefined,
      sqlStatement: (json.pySQLStatement as string) || (json.pyStatement as string) || undefined,
    };
  }

  public parseConnectFile(json: Record<string, unknown>): PegaConnectRule {
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Connect-File',
      pyName: this.extractName('Rule-Connect-File', json),
      pyLabel: (json.pyLabel as string) || undefined,
      connectType: 'File',
      filePath: (json.pyFilePath as string) || (json.pyFileName as string) || undefined,
      filePattern: (json.pyFilePattern as string) || undefined,
    };
  }

  public parseServiceRule(json: Record<string, unknown>): PegaServiceRule {
    const methodStr = (json.pyHttpMethod as string) || (json.pyHTTPMethod as string) || 'GET';
    return {
      pxObjClass: (json.pxObjClass as string) || 'Rule-Service-REST',
      pyName: this.extractName('Rule-Service-REST', json),
      serviceType: (json.pyServiceType as string) || this.inferServiceType(json),
      endpoint: this.resolveEndpoint(json),
      allowedMethods: methodStr.split(',').map(m => m.trim() as ConnectMethod).filter(m => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)),
    };
  }

  private resolveEndpoint(json: Record<string, unknown>): string | undefined {
    return (json.pyEndpointURL as string)
      || (json.pyBaseURL as string)
      || (json.pyResourcePath as string)
      || (json.pyUrl as string)
      || undefined;
  }

  private resolveMethod(json: Record<string, unknown>): ConnectMethod | undefined {
    const method = (json.pyHttpMethod as string) || (json.pyHTTPMethod as string) || (json.pyMethod as string);
    if (method && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      return method.toUpperCase() as ConnectMethod;
    }
    return undefined;
  }

  private resolveAuthType(json: Record<string, unknown>): AuthType | undefined {
    const auth = (json.pyAuthType as string) || '';
    if (!auth) return undefined;
    const lower = auth.toLowerCase();
    if (lower === 'basic') return 'basic';
    if (lower === 'oauth2') return 'oauth2';
    if (lower === 'apikey') return 'apiKey';
    if (lower === 'custom') return 'custom';
    if (lower === 'none') return 'none';
    if (lower.includes('oauth') || lower.includes('oauth2')) return 'oauth2';
    if (lower.includes('basic')) return 'basic';
    if (lower.includes('apikey') || lower.includes('api_key') || lower.includes('api key')) return 'apiKey';
    return 'custom';
  }

  private parseHeaders(json: Record<string, unknown>): PegaConnectHeader[] | undefined {
    const rawHeaders = json.pyHeaders as unknown[];
    if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) return undefined;
    return rawHeaders.map(h => {
      const header = h as Record<string, unknown>;
      return {
        pyName: (header.pyHeaderName as string) || (header.pyName as string) || '',
        pyValue: (header.pyHeaderValue as string) || (header.pyValue as string) || '',
      };
    });
  }

  private inferServiceType(json: Record<string, unknown>): string {
    const cls = (json.pxObjClass as string) || '';
    if (cls.startsWith('Rule-Service-REST')) return 'REST';
    if (cls.startsWith('Rule-Service-SOAP')) return 'SOAP';
    if (cls.startsWith('Rule-Service-File')) return 'File';
    if (cls.startsWith('Rule-Service-')) return cls.substring('Rule-Service-'.length);
    return 'REST';
  }

  private extractDependencies(json: Record<string, unknown>): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const className = (json.pyClassName as string) || '@baseclass';

    const authRef = (json.pyAuthProfile as string);
    if (authRef) {
      deps.push({ ruleType: 'Rule-Connect-AuthProfile', className: '@baseclass', ruleName: authRef });
    }
    const requestMapping = (json.pyRequestDataTransform as string);
    if (requestMapping) {
      deps.push({ ruleType: 'Rule-Obj-Model', className, ruleName: requestMapping });
    }
    const responseMapping = (json.pyResponseDataTransform as string);
    if (responseMapping) {
      deps.push({ ruleType: 'Rule-Obj-Model', className, ruleName: responseMapping });
    }

    return deps;
  }

  private buildLogicSummary(pxObjClass: string, json: Record<string, unknown>): string {
    const lines: string[] = [];
    lines.push(`${pxObjClass}: ${this.extractName(pxObjClass, json)}`);

    if (pxObjClass.startsWith('Rule-Connect-REST') || pxObjClass.startsWith('Rule-Connect-HTTP')) {
      lines.push(`  Endpoint: ${this.resolveEndpoint(json) || '(not set)'}`);
      lines.push(`  Method: ${this.resolveMethod(json) || 'GET'}`);
      const auth = (json.pyAuthProfile as string);
      if (auth) lines.push(`  Auth Profile: ${auth}`);
      const reqMap = (json.pyRequestDataTransform as string);
      if (reqMap) lines.push(`  Request Transform: ${reqMap}`);
      const resMap = (json.pyResponseDataTransform as string);
      if (resMap) lines.push(`  Response Transform: ${resMap}`);
    } else if (pxObjClass === 'Rule-Connect-SOAP') {
      lines.push(`  WSDL: ${(json.pyWSDLURL as string) || '(not set)'}`);
      lines.push(`  SOAP Action: ${(json.pySoapAction as string) || '(not set)'}`);
    } else if (pxObjClass === 'Rule-Connect-SQL') {
      lines.push(`  Data Source: ${(json.pyDataSource as string) || '(not set)'}`);
      const stmt = (json.pySQLStatement as string) || '';
      lines.push(`  Statement: ${stmt.substring(0, 80)}${stmt.length > 80 ? '...' : ''}`);
    } else if (pxObjClass === 'Rule-Connect-File') {
      lines.push(`  File Path: ${(json.pyFilePath as string) || '(not set)'}`);
      lines.push(`  Pattern: ${(json.pyFilePattern as string) || '(none)'}`);
    } else if (pxObjClass.startsWith('Rule-Service-')) {
      lines.push(`  Endpoint: ${this.resolveEndpoint(json) || '(not set)'}`);
      lines.push(`  Methods: ${(json.pyHttpMethod as string) || (json.pyHTTPMethod as string) || 'GET'}`);
    }

    return lines.join('\n');
  }
}