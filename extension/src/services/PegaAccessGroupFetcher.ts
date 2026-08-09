/**
 * PegaAccessGroupFetcher — Discovers access groups for a Pega application
 * via the D_pzAccessGroupsByApplication data page.
 * ⛔ Uses custom CodeIntelligence service (POST /datapage/list), NOT Pega public API.
 * Parameter names come from the DPage rule definition (AppName, AppVersion).
 */
import type { PegaHttpClient } from "./PegaHttpClient";
import type { LogFn, AccessGroupEntry } from "./PegaHierarchyHelpers";

/**
 * Fetch all access groups for an application via D_pzAccessGroupsByApplication.
 * Uses POST /api/CodeIntelligence/v1/datapage/list endpoint.
 * Non-fatal: returns empty array if the data page is unavailable.
 */
export async function fetchAccessGroupsForApp(
  client: PegaHttpClient, appName: string, appVersion: string, log: LogFn,
): Promise<AccessGroupEntry[]> {
  // Guard: skip if appName is empty — Pega returns 400 for missing required params
  if (!appName) {
    log(`[PegaHierarchy] Skipping D_pzAccessGroupsByApplication — appName is empty`);
    return [];
  }

  const base = client.getPegaEndpoint();
  const authHeader = await client.getAuthHeader();

  // Use custom CodeIntelligence endpoint (POST with JSON body)
  // Param names: AppName, AppVersion (from DPage rule definition)
  const url = `${base}/api/CodeIntelligence/v1/datapage/list?dataPageName=D_pzAccessGroupsByApplication`;

  // Build body — raw JSON text, Content-Type: text/plain (Pega CodeIntelligence protocol)
  const bodyText = JSON.stringify({ AppName: appName, ...(appVersion ? { AppVersion: appVersion } : {}) });

  try {
    log(`[PegaHierarchy] Fetching D_pzAccessGroupsByApplication: ${appName} ${appVersion || '(no version)'}`);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "text/plain" },
      body: bodyText,
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      return parseAccessGroupResults(data);
    }
    log(`[PegaHierarchy] D_pzAccessGroupsByApplication HTTP ${res.status}`);
  } catch (err) {
    log(`[PegaHierarchy] D_pzAccessGroupsByApplication failed: ${(err as Error).message}`);
  }
  return [];
}

/** Parse pxResults from the D_pzAccessGroupsByApplication response */
function parseAccessGroupResults(data: any): AccessGroupEntry[] {
  const groups = data.pxResults || data.results || [];
  if (!Array.isArray(groups)) { return []; }
  return groups.map((g: any) => ({
    name: g.pyAccessGroup || g.pxInsName || "",
    pzInsKey: g.pzInsKey || `DATA-ADMIN-OPERATOR-ACCESSGROUP ${g.pyAccessGroup || ""}`,
  }));
}
