/**
 * PegaHttpClient — Client HTTP giao tiếp giữa Extension, Pega Platform và Backend.
 */

import * as vscode from "vscode";
import { SECRET_KEYS } from "../models";

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
  constructor(private readonly secrets: vscode.SecretStorage) {}

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

  public async getObject(className: string, key: string): Promise<Record<string, unknown>> {
    const endpoint = `${this.getPegaEndpoint()}/api/v1/objects/${encodeURIComponent(className)}/${encodeURIComponent(key)}`;
    const authHeader = await this.getAuthHeader();
    const res = await fetch(endpoint, { headers: { Authorization: authHeader } });
    if (!res.ok) {
      throw new Error(`Failed to fetch Pega object (${className}/${key}): ${res.statusText}`);
    }
    return (await res.json()) as Record<string, unknown>;
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

    return {
      applicationName,
      accessGroup,
      caseTypesCount: caseTypes.length,
      filePath: "pega-project.json",
    };
  }
}
