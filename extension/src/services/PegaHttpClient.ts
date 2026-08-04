/**
 * PegaHttpClient — Client HTTP giao tiếp giữa Extension, Pega Platform và Backend.
 */

import * as vscode from "vscode";
import { createHash } from "crypto";
import { SECRET_KEYS } from "../models";
import { setProjectId } from "../extension";

export interface PegaOperatorContext {
  operatorId: string;
  activeAccessGroup: string;
  currentApplication: {
    name: string;
    version: string;
    pzInsKey: string;
  };
  rulesetStack: Array<{ name: string; version: string }>;
}

export class PegaHttpClient {
  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  private log(msg: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(msg);
    } else {
      console.log(msg);
    }
  }

  private async getAuthHeader(): Promise<string> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const username = config.get<string>("pegaUsername", "").trim();
    const password = (await this.secrets.get(SECRET_KEYS.pega)) || "";
    const credentials = Buffer.from(`${username}:${password}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private getPegaEndpoint(): string {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    return config.get<string>("pegaEndpoint", "http://localhost:8080/prweb").replace(/\/$/, "");
  }

  private getBackendUrl(): string {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    return config.get<string>("backendUrl", "http://localhost:48721").replace(/\/$/, "");
  }

  /** Public accessor for backend URL — used by PegaStreamIngester (SA4E-92) */
  public getBackendUrlPublic(): string {
    return this.getBackendUrl();
  }

  public async getOperatorContext(): Promise<PegaOperatorContext> {
    const base = this.getPegaEndpoint();
    const authHeader = await this.getAuthHeader();
    const headers = { Authorization: authHeader };
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const username = config.get<string>("pegaUsername", "").trim();

    for (const url of [`${base}/api/v1/data/D_OperatorID`, `${base}/PRRestService/api/v1/data/D_OperatorID`]) {
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as any;
          const operatorId = data.pyUserIdentifier || username;
          const activeAccessGroup = data.pyAccessGroup || "";
          const appName = activeAccessGroup ? activeAccessGroup.split(":")[0] : "PegaApp";
          const appInsKey = `RULE-APPLICATION ${appName.toUpperCase()}`;
          return {
            operatorId,
            activeAccessGroup,
            currentApplication: { name: appName, version: "v1", pzInsKey: appInsKey },
            rulesetStack: [],
          };
        }
        if (res.status === 401) { throw new Error("HTTP 401 Unauthorized (Invalid Operator ID or Password)"); }
        if (res.status === 403) { throw new Error("HTTP 403 Forbidden (Operator does not have access)"); }
      } catch (err: any) {
        if (err.message.includes("401") || err.message.includes("403")) { throw err; }
      }
    }

    for (const url of [`${base}/api/v1/casetypes`, `${base}/PRRestService/api/v1/casetypes`]) {
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as any;
          const appName = data.caseTypes?.[0]?.name || "Pega App";
          return {
            operatorId: username,
            activeAccessGroup: "",
            currentApplication: { name: appName, version: "v1", pzInsKey: `RULE-APPLICATION ${appName.toUpperCase()}` },
            rulesetStack: [],
          };
        }
      } catch { /* skip */ }
    }

    throw new Error("Failed to connect to Pega Server");
  }

  /**
   * Deterministic 4-Step Hierarchy Resolution:
   * Account (Operator ID) => Access Group => Application Rule => All RuleSets + Rules/Data
   */
  public async resolveDeterministicPegaHierarchy(operatorIdHint?: string): Promise<{
    seeds: string[];
    operatorId: string;
    accessGroup: string;
    appName: string;
    ruleSets: string[];
  }> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const opId = (operatorIdHint || config.get<string>("pegaUsername", "") || "SSA@TGB").trim();
    const seedSet = new Set<string>();
    let accessGroup = "";
    let appName = "";
    let appVersion = "";
    const ruleSets: string[] = [];

    // Step 1: Account Context (DATA-ADMIN-OPERATOR-ID)
    const opInsKey = `DATA-ADMIN-OPERATOR-ID ${opId.toUpperCase()}`;
    seedSet.add(opInsKey);
    this.log(`[PegaHttpClient] 🔍 Step 1 (Account): Resolving Operator "${opId}"...`);
    try {
      const opObj = await this.getRuleByInsKey(opInsKey);
      accessGroup = (opObj.pyDefaultAccessGroup as string) || (opObj.pyAccessGroup as string) || "";
      this.log(`[PegaHttpClient] ✅ Step 1 Success: Default Access Group = "${accessGroup}"`);
    } catch (err: any) {
      this.log(`[PegaHttpClient] ⚠️ Step 1 Warning: Could not fetch Operator ${opInsKey}: ${err.message}`);
    }

    // Step 2: Access Group => Application Rule
    if (accessGroup) {
      const agInsKey = `DATA-ADMIN-OPERATOR-ACCESSGROUP ${accessGroup}`;
      seedSet.add(agInsKey);
      this.log(`[PegaHttpClient] 🔍 Step 2 (Access Group): Resolving "${accessGroup}"...`);
      try {
        const agObj = await this.getRuleByInsKey(agInsKey);
        appName = (agObj.pyApplication as string) || (agObj.pyAppName as string) || (agObj.pyApplicationName as string) || (agObj.pyAccessGroupAppName as string) || (agObj.pyDefaultAppName as string) || "";
        appVersion = (agObj.pyApplicationVersion as string) || (agObj.pyAppVersion as string) || (agObj.pyAccessGroupAppVersion as string) || (agObj.pyDefaultAppVersion as string) || "";
        if (!appName && accessGroup.includes(":")) {
          appName = accessGroup.split(":")[0];
        }
        this.log(`[PegaHttpClient] ✅ Step 2 Success: Application = "${appName}" (Version: "${appVersion || "Auto"}")`);
      } catch (err: any) {
        if (accessGroup.includes(":")) {
          appName = accessGroup.split(":")[0];
        }
        this.log(`[PegaHttpClient] ⚠️ Step 2 Warning: Could not fetch Access Group ${agInsKey}: ${err.message}`);
      }
    }

    // Step 3: Application Rule => All RuleSets
    if (appName) {
      // "Auto" is not a valid version for insKey lookup — treat as unknown
      const validVersion = appVersion && appVersion.toLowerCase() !== "auto" ? appVersion : null;
      const appKeysToTry = [
        validVersion ? `RULE-APPLICATION ${appName.toUpperCase()} ${validVersion}` : null,
        // Try common version patterns if version unknown
        !validVersion ? `RULE-APPLICATION ${appName.toUpperCase()} 01.01` : null,
        !validVersion ? `RULE-APPLICATION ${appName.toUpperCase()} 01-01-01` : null,
        `RULE-APPLICATION ${appName.toUpperCase()}`,
        `RULE-APPLICATION ${appName}`,
      ].filter(Boolean) as string[];

      let appObj: Record<string, unknown> | null = null;
      for (const appKey of appKeysToTry) {
        try {
          this.log(`[PegaHttpClient] 🔍 Step 3 (Application Rule): Fetching "${appKey}"...`);
          appObj = await this.getRuleByInsKey(appKey);
          seedSet.add(appKey);
          this.log(`[PegaHttpClient] ✅ Step 3 Success: Loaded Application Rule "${appKey}"`);
          break;
        } catch {
          // try next variation
        }
      }

      if (appObj) {
        // Read pyRuleSetList
        const rawRuleSets = (appObj.pyRuleSetList || appObj.pyRuleSets) as any[];
        if (Array.isArray(rawRuleSets)) {
          for (const rs of rawRuleSets) {
            const rsName = typeof rs === "string" ? rs : (rs.pyRuleSet || rs.pyRuleSetName || rs.pxSubRuleSet);
            const rsVer = typeof rs === "object" ? (rs.pyRuleSetVersion || rs.pyVersion) : "";
            if (rsName) {
              const fullRsKey = rsVer ? `${rsName}:${rsVer}` : rsName;
              ruleSets.push(fullRsKey);
              seedSet.add(`RULE-RULESET-NAME ${rsName.toUpperCase()}`);
            }
          }
        }
        // Read pyWorkTypes / pyDataClasses
        const workTypes = (appObj.pyWorkTypes || appObj.pyCaseTypes) as any[];
        if (Array.isArray(workTypes)) {
          for (const wt of workTypes) {
            const className = typeof wt === "string" ? wt : (wt.pyWorkTypeClass || wt.pyClassName || wt.pxObjClass);
            if (className) {
              seedSet.add(`RULE-OBJ-CLASS ${className}`);
            }
          }
        }
      }
    }

    const seeds = Array.from(seedSet);
    return {
      seeds,
      operatorId: opId,
      accessGroup,
      appName: appName || "PegaApp",
      ruleSets,
    };
  }

  private activePrefix: string | null = null;

  public async getObject(className: string, key: string, appliesTo?: string): Promise<Record<string, unknown>> {
    let insKey = key;
    if (!key.includes(" ")) {
      const cleanAppliesTo = (appliesTo && appliesTo !== "@baseclass") ? appliesTo : "";
      if (cleanAppliesTo) {
        insKey = `${className.toUpperCase()} ${cleanAppliesTo} ${key}`;
      } else {
        insKey = `${className.toUpperCase()} ${key}`;
      }
    }

    try {
      return await this.getRuleByInsKey(insKey);
    } catch (err: any) {
      if (err.message.includes("HTTP 504") || err.message.includes("HTTP 503") || err.message.includes("HTTP 502") || err.message.includes("HTTP 500") || err.message.includes("HTTP 401")) {
        throw err;
      }
      // Fallback: try queryRuleByTriple
      return await this.queryRuleByTriple(className, appliesTo || "", key);
    }
  }

  private getCustomRestPrefixes(): string[] {
    const base = this.getPegaEndpoint();
    const prefixes = [
      `${base}/api/CodeIntelligence/v1`,
      `${base}/PRRestService/CodeIntelligence/v1`,
      `${base}/api/HRAppsV2Service/V1`,
      `${base}/PRRestService/HRAppsV2Service/V1`,
      `${base}/api/HRAppsV2/V1`,
      `${base}/PRRestService/HRAppsV2/V1`,
      `${base}/api/v1`,
      `${base}/PRRestService/v1`,
    ];
    if (this.activePrefix) {
      return [this.activePrefix, ...prefixes.filter(p => p !== this.activePrefix)];
    }
    return prefixes;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const res = await fetch(url, init);
        if (res.status === 503 || res.status === 504 || res.status === 502) {
          attempt++;
          if (attempt <= maxRetries) {
            const retryAfterHeader = res.headers.get("retry-after");
            let backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
            if (retryAfterHeader && !isNaN(Number(retryAfterHeader))) {
              backoffMs = Number(retryAfterHeader) * 1000;
            }
            this.log(`[PegaHttpClient] ⏳ HTTP ${res.status} on ${url}. Retrying in ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries})...`);
            await this.delay(backoffMs);
            continue;
          }
        }
        return res;
      } catch (err: any) {
        attempt++;
        if (attempt <= maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          this.log(`[PegaHttpClient] ⏳ Network Error: ${err.message}. Retrying in ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries})...`);
          await this.delay(backoffMs);
          continue;
        }
        throw err;
      }
    }
    return fetch(url, init);
  }

  /**
   * Service 1: GET /rules/{insKey}
   * Tải 100% nội dung Rule XML/JSON gốc theo insKey duy nhất.
   */
  public async getRuleByInsKey(insKey: string): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    const logs: string[] = [];
    for (const prefix of this.getCustomRestPrefixes()) {
      const url = `${prefix}/rules/${encodeURIComponent(insKey)}`;
      try {
        const res = await this.fetchWithRetry(url, {
          headers: { Authorization: authHeader, Accept: "application/json" },
        });
        const text = await res.text();
        this.log(`[PegaHttpClient] 📡 GET ${url} => HTTP ${res.status} (${text.length} bytes)`);
        
        if (res.ok) {
          this.activePrefix = prefix;
          const json = JSON.parse(text) as Record<string, unknown>;
          if (json && !json.error && json.pyHTTPResponseCode !== "404" && json.pyHTTPResponseCode !== 404) {
            return json;
          }
          throw new Error(String(json.error || `Rule not found: ${insKey}`));
        }

        if (res.status === 404) {
          this.activePrefix = prefix;
          throw new Error(`Rule not found: ${insKey}`);
        }

        if (res.status === 504 || res.status === 503 || res.status === 502 || res.status === 500 || res.status === 401 || res.status === 403) {
          throw new Error(`HTTP ${res.status} ${res.statusText || "Server Error"}`);
        }

        logs.push(`GET ${url} => HTTP ${res.status}: ${text.substring(0, 150)}`);
      } catch (err: any) {
        if (err.message.includes("Rule not found") || err.message.includes("HTTP 504") || err.message.includes("HTTP 503") || err.message.includes("HTTP 502") || err.message.includes("HTTP 401")) {
          throw err;
        }
        logs.push(`GET ${url} => Network Error: ${err.message}`);
      }
    }
    throw new Error(`GET /rules/${insKey} failed:\n  ${logs.join("\n  ")}`);
  }

  /**
   * Service 2: POST /rules/query
   * Truy vấn chính xác Rule theo bộ 3 pxObjClass, appliesTo, pyRuleName.
   */
  public async queryRuleByTriple(pxObjClass: string, appliesTo: string, pyRuleName: string): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    const logs: string[] = [];
    for (const prefix of this.getCustomRestPrefixes()) {
      const queryParams = `pxObjClass=${encodeURIComponent(pxObjClass)}&appliesTo=${encodeURIComponent(appliesTo || "")}&pyRuleName=${encodeURIComponent(pyRuleName)}&RequestClass=${encodeURIComponent(pxObjClass)}&RequestAppliesTo=${encodeURIComponent(appliesTo || "")}&RequestRuleName=${encodeURIComponent(pyRuleName)}`;
      const url = `${prefix}/rules/query?${queryParams}`;
      const payload = {
        ruleJson: JSON.stringify({
          RequestClass: pxObjClass,
          RequestAppliesTo: appliesTo,
          RequestRuleName: pyRuleName,
        }),
      };
      try {
        const res = await this.fetchWithRetry(url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        this.log(`[PegaHttpClient] 📡 POST ${url} Payload: ${JSON.stringify(payload.ruleJson)} => HTTP ${res.status} (${text.length} bytes)`);

        if (res.ok) {
          this.activePrefix = prefix;
          if (!text || !text.trim()) {
            throw new Error(`Rule not found for triple: ${pxObjClass} | ${appliesTo} | ${pyRuleName}`);
          }
          let json: Record<string, unknown> = {};
          try {
            json = JSON.parse(text);
          } catch {
            throw new Error(`Rule not found for triple: ${pxObjClass} | ${appliesTo} | ${pyRuleName}`);
          }
          if (json && !json.error && json.pyHTTPResponseCode !== "404" && json.pyHTTPResponseCode !== 404) {
            return json;
          }
          throw new Error(String(json.error || `Rule not found for triple: ${pxObjClass} | ${appliesTo} | ${pyRuleName}`));
        }

        if (res.status === 404) {
          this.activePrefix = prefix;
          throw new Error(`Rule not found for triple: ${pxObjClass} | ${appliesTo} | ${pyRuleName}`);
        }

        if (res.status === 504 || res.status === 503 || res.status === 502 || res.status === 500 || res.status === 401 || res.status === 403) {
          throw new Error(`HTTP ${res.status} ${res.statusText || "Server Error"}`);
        }

        logs.push(`POST ${url} => HTTP ${res.status}: ${text.substring(0, 150)}`);
      } catch (err: any) {
        if (err.message.includes("Rule not found") || err.message.includes("HTTP 504") || err.message.includes("HTTP 503") || err.message.includes("HTTP 502") || err.message.includes("HTTP 401")) {
          throw err;
        }
        logs.push(`POST ${url} => Network Error: ${err.message}`);
      }
    }
    throw new Error(`POST /rules/query failed:\n  ${logs.join("\n  ")}`);
  }

  /**
   * Service 3: POST /rules/list
   * Quét danh sách tất cả các Rule summaries theo RuleSet / Application.
   */
  public async listApplicationRules(pxObjClass: string, appliesTo = "", pageSize = 50, pageIndex = 1): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    for (const prefix of this.getCustomRestPrefixes()) {
      try {
        const queryParams = `pxObjClass=${encodeURIComponent(pxObjClass)}&appliesTo=${encodeURIComponent(appliesTo)}&pageSize=${pageSize}&pageIndex=${pageIndex}&RequestClass=${encodeURIComponent(pxObjClass)}&RequestAppliesTo=${encodeURIComponent(appliesTo)}`;
        const url = `${prefix}/rules/list?${queryParams}`;
        const res = await this.fetchWithRetry(url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ruleJson: JSON.stringify({
              RequestClass: pxObjClass,
              RequestAppliesTo: appliesTo,
              pageSize,
              pageIndex,
            }),
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && !json.error) {
            return json;
          }
        }
      } catch { /* try next prefix */ }
    }
    throw new Error(`POST /rules/list failed on all custom REST prefixes`);
  }

  /**
   * Truy vấn tất cả các Rule của 1 loại (Rule-Obj-Activity, Rule-Obj-Flow, Rule-Obj-Model...) thuộc về 1 Class cụ thể.
   */
  public async getClassRules(className: string, ruleType: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    try {
      const data = await this.listApplicationRules(ruleType, className, pageSize, 1);
      const pxResults = (data.pxResults || data.pxResult || data.rules || data.properties || []) as Record<string, unknown>[];
      return Array.isArray(pxResults) ? pxResults : [];
    } catch {
      return [];
    }
  }

  /**
   * Truy vấn tất cả các Property (Rule-Obj-Property) thuộc về 1 Class cụ thể.
   * Lớp Class => Lấy danh sách Property
   */
  public async getClassProperties(className: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    return this.getClassRules(className, "Rule-Obj-Property", pageSize);
  }

  /**
   * Service 4: POST /rules/save
   * Tạo mới hoặc cập nhật Rule Instance qua Transactional Commit.
   * @param target - RuleSet version đích (inject pyRuleSet/pyRuleSetVersion vào ruleJson).
   */
  public async savePegaRule(
    rulePayload: string | Record<string, unknown>,
    target?: { pyRuleSet?: string; pyRuleSetVersion?: string }
  ): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    const payloadObj = typeof rulePayload === "object" ? { ...rulePayload } : JSON.parse(rulePayload);
    if (target?.pyRuleSet) {
      payloadObj.pyRuleSet = target.pyRuleSet;
    }
    if (target?.pyRuleSetVersion) {
      payloadObj.pyRuleSetVersion = target.pyRuleSetVersion;
    }
    const payloadStr = JSON.stringify(payloadObj);
    for (const prefix of this.getCustomRestPrefixes()) {
      try {
        const url = `${prefix}/rules/save`;
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ ruleJson: payloadStr }),
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && !json.error) {
            return json;
          }
        }
      } catch { /* try next prefix */ }
    }
    throw new Error(`POST /rules/save failed on all custom REST prefixes`);
  }

  /**
   * Service 5: POST /rules/checkout
   * Thực thi quy trình Lock Control (Checkout / Checkin / UndoCheckout).
   * @param branch - Branch context (branchName/branchVersion) xác định trước khi checkout.
   */
  public async checkoutPegaRule(
    insKey: string,
    action: "CHECKOUT" | "CHECKIN" | "UNDOCHECKOUT",
    comment?: string,
    branch?: { branchName: string; branchVersion: string }
  ): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    for (const prefix of this.getCustomRestPrefixes()) {
      try {
        const branchParams = branch
          ? `&branchName=${encodeURIComponent(branch.branchName)}&branchVersion=${encodeURIComponent(branch.branchVersion)}&RequestBranchName=${encodeURIComponent(branch.branchName)}&RequestBranchVersion=${encodeURIComponent(branch.branchVersion)}`
          : "";
        const queryParams = `insKey=${encodeURIComponent(insKey)}&action=${encodeURIComponent(action)}&comment=${encodeURIComponent(comment || "")}&RequestPZInsKey=${encodeURIComponent(insKey)}&RequestAction=${encodeURIComponent(action)}&RequestComment=${encodeURIComponent(comment || "")}${branchParams}`;
        const url = `${prefix}/rules/checkout?${queryParams}`;
        const bodyObj = {
          insKey,
          action,
          comment: comment || "Updated via SDLC AI Multi-Agent Pipeline",
          RequestPZInsKey: insKey,
          RequestAction: action,
          RequestComment: comment || "Updated via SDLC AI Multi-Agent Pipeline",
          ruleJson: JSON.stringify({ insKey, action, comment }),
        };
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(bodyObj),
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && !json.error) {
            return json;
          }
        }
      } catch { /* try next prefix */ }
    }
    throw new Error(`POST /rules/checkout failed on all custom REST prefixes`);
  }

  /**
   * Service 6: POST /rules/test
   * Kích hoạt QA Scenario Unit Test Suite trên Pega Server.
   */
  public async executeScenarioTestSuite(testSuiteID?: string, insKey?: string): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    for (const prefix of this.getCustomRestPrefixes()) {
      try {
        const queryParams = `testSuiteID=${encodeURIComponent(testSuiteID || "")}&insKey=${encodeURIComponent(insKey || "")}&RequestTestSuiteID=${encodeURIComponent(testSuiteID || "")}&RequestPZInsKey=${encodeURIComponent(insKey || "")}`;
        const url = `${prefix}/rules/test?${queryParams}`;
        const bodyObj = {
          testSuiteID: testSuiteID || "",
          insKey: insKey || "",
          RequestTestSuiteID: testSuiteID || "",
          RequestPZInsKey: insKey || "",
          ruleJson: JSON.stringify({ testSuiteID, insKey }),
        };
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(bodyObj),
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && !json.error) {
            return json;
          }
        }
      } catch { /* try next prefix */ }
    }
    throw new Error(`POST /rules/test failed on all custom REST prefixes`);
  }

  /**
   * Service 7: POST /rules/branch
   * Tạo branch version mới trong Pega: clone `{baseVersion}` thành `{baseVersion}:{branchName}`
   * (vd 01-01-01:ssa_SA4E-58) và mở để edit. Idempotent — nếu branch đã tồn tại trả về EXISTS.
   */
  public async createPegaBranch(
    rulesetName: string,
    baseVersion = "01-01-01",
    branchName: string
  ): Promise<Record<string, unknown>> {
    const authHeader = await this.getAuthHeader();
    const branchVersion = `${baseVersion}:${branchName}`;
    for (const prefix of this.getCustomRestPrefixes()) {
      try {
        const queryParams = `rulesetName=${encodeURIComponent(rulesetName)}&baseVersion=${encodeURIComponent(baseVersion)}&branchName=${encodeURIComponent(branchName)}&branchVersion=${encodeURIComponent(branchVersion)}&RequestRuleSetName=${encodeURIComponent(rulesetName)}&RequestBaseVersion=${encodeURIComponent(baseVersion)}&RequestBranchName=${encodeURIComponent(branchName)}&RequestBranchVersion=${encodeURIComponent(branchVersion)}`;
        const url = `${prefix}/rules/branch?${queryParams}`;
        const bodyObj = {
          rulesetName,
          baseVersion,
          branchName,
          branchVersion,
          RequestRuleSetName: rulesetName,
          RequestBaseVersion: baseVersion,
          RequestBranchName: branchName,
          RequestBranchVersion: branchVersion,
          ruleJson: JSON.stringify({ rulesetName, baseVersion, branchName, branchVersion }),
        };
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(bodyObj),
        });
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          if (json && !json.error) {
            return json;
          }
        }
      } catch { /* try next prefix */ }
    }
    throw new Error(`POST /rules/branch failed on all custom REST prefixes`);
  }

  public async checkBackendCache(body: Record<string, unknown>): Promise<any> {
    const endpoint = `${this.getBackendUrl()}/api/v1/pega/check-rule`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { return { cached: false }; }
    const json = (await res.json()) as any;
    return json.data || { cached: false };
  }

  public async ingestBackendRule(body: Record<string, unknown>): Promise<any> {
    const endpoint = `${this.getBackendUrl()}/api/v1/pega/ingest-rule`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { throw new Error(`Backend ingest failed: ${res.statusText}`); }
    const json = (await res.json()) as any;
    return json.data || {};
  }

  public async crawlPlan(body: {
    projectId: string;
    ruleKeys: string[];
    visitedKeys: string[];
    ruleChecksums?: Record<string, string>;
  }): Promise<{ missing: Array<{ insKey: string; pxObjClass: string; pyClassName: string; pyRuleName: string }>; cached: string[] }> {
    const endpoint = `${this.getBackendUrl()}/api/v1/pega/crawl-plan`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { throw new Error(`Crawl plan failed: ${res.statusText}`); }
    const json = (await res.json()) as any;
    return json.data || { missing: [], cached: [] };
  }

  public async crawlBatch(body: {
    projectId: string;
    rules: Record<string, unknown>[];
    visitedKeys: string[];
    rulesChecksums?: Record<string, string>;
    rulesVersions?: Record<string, string>;
  }): Promise<{ stored: number; totalRulesInDb?: number; totalKbEntriesInDb?: number; totalGraphNodesInDb?: number; nextBatch: Array<{ insKey: string; pxObjClass: string; pyClassName: string; pyRuleName: string }> }> {
    const endpoint = `${this.getBackendUrl()}/api/v1/pega/crawl-batch`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { throw new Error(`Crawl batch failed: ${res.statusText}`); }
    const json = (await res.json()) as any;
    return json.data || { stored: 0, nextBatch: [] };
  }

  public async detectProject(workspaceRoot: string): Promise<{
    isPegaProject: boolean;
    applicationName?: string;
    rulesetName?: string;
    confidence: number;
    indicators: string[];
  }> {
    const endpoint = `${this.getBackendUrl()}/api/v1/pega/detect-project`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceRoot }),
    });
    if (!res.ok) { throw new Error(`Detect project failed: ${res.statusText}`); }
    const json = (await res.json()) as any;
    return json.data || { isPegaProject: false, confidence: 0, indicators: [] };
  }

  public async fetchAndSavePegaContext(workspaceRoot: string): Promise<{
    applicationName: string;
    accessGroup: string;
    caseTypesCount: number;
    filePath: string;
  }> {
    const base = this.getPegaEndpoint();
    const authHeader = await this.getAuthHeader();
    const headers = { Authorization: authHeader };
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const username = config.get<string>("pegaUsername", "").trim();

    let operatorId = username;
    let operatorName = "";
    let accessGroup = "";
    let applicationName = "";
    let organization = "";
    let division = "";
    let unit = "";

    // 1. Fetch exact Operator & Access Group from D_OperatorID data page
    for (const ep of [`${base}/api/v1/data/D_OperatorID`, `${base}/PRRestService/api/v1/data/D_OperatorID`]) {
      try {
        const res = await fetch(ep, { headers });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as any;
          operatorId = data.pyUserIdentifier || username;
          operatorName = data.pyUserName || "";
          accessGroup = data.pyAccessGroup || "";
          organization = data.pyOrganization || "";
          division = data.pyOrgDivision || "";
          unit = data.pyOrgUnit || "";
          if (accessGroup) {
            applicationName = accessGroup.split(":")[0];
          }
          break;
        }
      } catch { /* skip fallback */ }
    }

    // 2. Fetch CaseTypes list
    let caseTypes: Array<{ name: string; caseTypeID: string }> = [];
    for (const ep of [`${base}/api/v1/casetypes`, `${base}/PRRestService/api/v1/casetypes`]) {
      try {
        const res = await fetch(ep, { headers });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as any;
          if (Array.isArray(data.caseTypes)) {
            caseTypes = data.caseTypes.map((c: any) => ({
              name: c.name || c.caseTypeName || "CaseType",
              caseTypeID: c.caseTypeID || c.ID || "",
            }));
            break;
          }
        }
      } catch { /* skip */ }
    }

    // 3. Fallbacks if D_OperatorID wasn't accessible
    if (!applicationName) {
      for (const ep of [`${base}/api/v1/applications`, `${base}/PRRestService/api/v1/applications`]) {
        try {
          const res = await fetch(ep, { headers });
          if (res.ok) {
            const data = (await res.json().catch(() => ({}))) as any;
            const apps = data.applications || data.applicationList;
            if (Array.isArray(apps) && apps.length > 0) {
              applicationName = apps[0].name || apps[0].applicationName || "";
              break;
            }
          }
        } catch { /* skip */ }
      }
    }

    if (!applicationName) {
      applicationName = caseTypes.length > 0 ? caseTypes[0].caseTypeID.split("-")[1] || "PegaApp" : "PegaApp";
    }

    const applicationInsKey = `RULE-APPLICATION ${applicationName.toUpperCase()}`;
    const accessGroupInsKey = accessGroup ? `RULE-OBJ-ACCESSGROUP ${accessGroup.toUpperCase()}` : "";
    const operatorInsKey = `DATA-ADMIN-OPERATOR-ID ${operatorId.toUpperCase()}`;

    const jsonPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), "pega-project.json");
    const xmlPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), "Application.xml");

    const projectData = {
      isPegaProject: true,
      pegaEndpoint: base,
      operatorId,
      operatorName,
      operatorInsKey,
      accessGroup,
      accessGroupInsKey,
      applicationName,
      applicationInsKey,
      pzInsKey: applicationInsKey,
      organization,
      division,
      unit,
      caseTypes,
      fetchedAt: new Date().toISOString(),
    };

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<application name="${applicationName}" accessGroup="${accessGroup}" pzInsKey="${applicationInsKey}">
  <operator id="${operatorId}" name="${operatorName}" pzInsKey="${operatorInsKey}"/>
  <accessGroup name="${accessGroup}" pzInsKey="${accessGroupInsKey}"/>
  <organization name="${organization}" division="${division}" unit="${unit}"/>
  <endpoint url="${base}"/>
</application>`;

    await vscode.workspace.fs.writeFile(jsonPath, Buffer.from(JSON.stringify(projectData, null, 2), "utf-8"));
    await vscode.workspace.fs.writeFile(xmlPath, Buffer.from(xmlContent, "utf-8"));

    // Derive and persist project ID from Pega application name
    const codeIntelDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), ".code-intel");
    await vscode.workspace.fs.createDirectory(codeIntelDir);
    const pjPath = vscode.Uri.joinPath(codeIntelDir, "project.json");
    const projectId = createHash("sha256").update("pega:" + applicationName).digest("hex").slice(0, 12);
    await vscode.workspace.fs.writeFile(pjPath, Buffer.from(JSON.stringify({ projectId }, null, 2), "utf-8"));
    // Update extension runtime project_id immediately
    setProjectId(projectId);

    return {
      applicationName,
      accessGroup,
      caseTypesCount: caseTypes.length,
      filePath: "pega-project.json",
    };
  }
}
