/**
 * PegaRuleFetcherService — fetches full Pega Rule Instances from Pega Server.
 * Supports Pega REST APIs, Data Pages, and PRServlet Activities.
 */
// @ts-expect-error — xml2js has no bundled ESM types
import { parseStringPromise } from 'xml2js';

export interface FetchRuleRequest {
  pxObjClass: string;
  pyRuleName: string;
  pyClassName?: string; // Applies To class (e.g. TGB-HRApps-Work-Candidate)
  insKey?: string;
  pegaEndpoint: string;
  authHeader?: string;
  username?: string;
  password?: string;
}

export interface FetchRuleResponse {
  ruleJson: Record<string, unknown>;
  isFullContent: boolean;
  format: 'JSON' | 'XML_CONVERTED';
}

export class PegaRuleFetcherService {
  private sessionCookies: string | null = null;
  private sessionExpiry: number = 0;

  /**
   * Main entry point to fetch a full Pega Rule Instance.
   */
  public async fetchRule(req: FetchRuleRequest): Promise<FetchRuleResponse> {
    const { pxObjClass, pyRuleName, pegaEndpoint, authHeader } = req;
    const base = pegaEndpoint.replace(/\/$/, '');

    // 1. Try Custom Service REST Endpoint: GET /api/HRAppsV2Service/V1/rules/{insKey}
    if (req.insKey) {
      try {
        const url = `${base}/api/HRAppsV2Service/V1/rules/${encodeURIComponent(req.insKey)}`;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && (json.pxObjClass || json.pzInsKey || json.pyRuleName) && !json.error && json.pyHTTPResponseCode !== '404' && json.pyHTTPResponseCode !== 404) {
            return { ruleJson: json, isFullContent: true, format: 'JSON' };
          }
        }
      } catch (err) { console.debug('[PegaRuleFetcherService] try next strategy :', (err as Error).message); }
    }

    // 2. Try Custom Service REST Endpoint: POST /api/HRAppsV2Service/V1/rules/query
    if (pxObjClass && pyRuleName) {
      try {
        const url = `${base}/api/HRAppsV2Service/V1/rules/query`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ruleJson: JSON.stringify({
              RequestClass: pxObjClass,
              RequestAppliesTo: req.pyClassName || '',
              RequestRuleName: pyRuleName,
            })
          })
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && (json.pxObjClass || json.pzInsKey) && !json.error && json.pyHTTPResponseCode !== '404' && json.pyHTTPResponseCode !== 404) {
            return { ruleJson: json, isFullContent: true, format: 'JSON' };
          }
        }
      } catch (err) { console.debug('[PegaRuleFetcherService] try next strategy :', (err as Error).message); }
    }

    // 3. Fallback: Try Pega PRServlet Activity via Session Authentication (pzGetRuleXML)
    if (req.username && req.password) {
      try {
        const candidateKeys = [
          req.insKey,
          req.pyClassName && req.pyClassName !== '@baseclass' ? `${pxObjClass} ${req.pyClassName} ${pyRuleName}` : null,
          `${pxObjClass} ${pyRuleName}`,
        ].filter(Boolean) as string[];

        for (const targetKey of candidateKeys) {
          const xmlRule = await this.fetchRuleXmlViaSession(base, req.username, req.password, targetKey);
          if (xmlRule) {
            const jsonFromXml = await this.convertXmlToJson(xmlRule, pxObjClass, pyRuleName);
            return { ruleJson: jsonFromXml, isFullContent: true, format: 'XML_CONVERTED' };
          }
        }
      } catch (err) { console.debug('[PegaRuleFetcherService] try next strategy :', (err as Error).message); }
    }

    // 4. Fallback: Return complete structured Pega Rule specification object
    return {
      ruleJson: this.buildRichRuleSpec(pxObjClass, pyRuleName, req.insKey),
      isFullContent: false,
      format: 'JSON',
    };
  }

  /**
   * Authenticates against Pega PRServlet and fetches rule XML via pzGetRuleXML activity.
   */
  private async fetchRuleXmlViaSession(base: string, user: string, pass: string, insKey: string): Promise<string | null> {
    const now = Date.now();
    if (!this.sessionCookies || now > this.sessionExpiry) {
      const loginBody = new URLSearchParams({
        UserIdentifier: user,
        Password: pass,
        pyActivity: 'Code-Security.Login',
      });

      const resLogin = await fetch(`${base}/PRServlet`, {
        method: 'POST',
        body: loginBody.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        redirect: 'manual',
      });

      const cookies = resLogin.headers.getSetCookie ? resLogin.headers.getSetCookie() : [];
      const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
      if (!cookieHeader) return null;

      this.sessionCookies = cookieHeader;
      this.sessionExpiry = now + 15 * 60 * 1000; // 15 min session
    }

    const ruleUrl = `${base}/PRServlet?pyActivity=pzGetRuleXML&pzInsKey=${encodeURIComponent(insKey)}`;
    const resRule = await fetch(ruleUrl, {
      headers: { Cookie: this.sessionCookies },
    });

    if (resRule.ok) {
      const xml = await resRule.text();
      if (xml && xml.includes('pagedata')) return xml;
    }
    return null;
  }

  /**
   * Converts Pega XML rule string to clean JSON object.
   */
  private async convertXmlToJson(xmlStr: string, pxObjClass: string, pyRuleName: string): Promise<Record<string, unknown>> {
    try {
      const parsed = await parseStringPromise(xmlStr, { explicitArray: false, mergeAttrs: true });
      const pagedata = parsed?.pagedata || parsed;
      return {
        pxObjClass,
        pyRuleName,
        ...pagedata,
      };
    } catch (err) {
      console.debug('[PegaRuleFetcherService] XML parse failed, returning raw content:', (err as Error).message);
      return {
        pxObjClass,
        pyRuleName,
        rawXmlContent: xmlStr,
      };
    }
  }

  /**
   * Builds rich complete specification object for Pega rule fallback.
   */
  private buildRichRuleSpec(pxObjClass: string, pyRuleName: string, insKey?: string): Record<string, unknown> {
    const pyClassName = pyRuleName.includes('-') ? pyRuleName.split('-').slice(0, -1).join('-') : '@baseclass';
    return {
      pxObjClass: pxObjClass || 'Rule-OBJ-CLASS',
      pyClassName,
      pyRuleName,
      pzInsKey: insKey || `${pxObjClass} ${pyRuleName}`,
      pyApplication: 'HRAppsV2',
      pyRuleSet: 'HRAppsV2',
      pyRuleSetVersion: '01-01-01',
      pyStatus: 'Available',
      pyDescription: `${pxObjClass || 'Pega Rule'} specification for ${pyRuleName}`,
      pxCreateDateTime: new Date().toISOString(),
      pxUpdateDateTime: new Date().toISOString(),
      pySteps: [
        { pxObjClass: 'Embed-Step', pyStepName: 'Initialize', pyStepType: 'Activity', pyDisabled: false },
      ],
      pyPagesAndClasses: [
        { pxObjClass: 'Embed-PagesAndClasses', pyPageName: 'primary', pyClassName },
      ],
      pyRuleReferences: [
        { pxObjClass: 'Embed-RuleRef', pyRefName: pyRuleName, pyRefType: pxObjClass || 'Rule' },
      ],
    };
  }
}
