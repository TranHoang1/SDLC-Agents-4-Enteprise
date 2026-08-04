/**
 * PegaAccessGroupFetcher — Discovers access groups for a Pega application
 * via the D_pzAccessGroupsByApplication data page.
 */
import type { PegaHttpClient } from "./PegaHttpClient";
import type { LogFn, AccessGroupEntry } from "./PegaHierarchyHelpers";

/**
 * Fetch all access groups for an application via D_pzAccessGroupsByApplication.
 * Non-fatal: returns empty array if the data page is unavailable.
 */
export async function fetchAccessGroupsForApp(
  client: PegaHttpClient, appName: string, appVersion: string, log: LogFn,
): Promise<AccessGroupEntry[]> {
  // Normalize app name/version: replace "-" with "." for data page parameter
  const normalizedAppName = appName.replace(/-/g, ".");
  const normalizedVersion = appVersion.replace(/-/g, ".");

  const base = client.getPegaEndpoint();
  const authHeader = await client.getAuthHeader();

  const endpoints = [
    `${base}/api/v1/data/D_pzAccessGroupsByApplication?ApplicationName=${normalizedAppName}&ApplicationVersion=${normalizedVersion}`,
    `${base}/PRRestService/api/v1/data/D_pzAccessGroupsByApplication?ApplicationName=${normalizedAppName}&ApplicationVersion=${normalizedVersion}`,
  ];

  for (const ep of endpoints) {
    try {
      log(`[PegaHierarchy] Fetching D_pzAccessGroupsByApplication: ${normalizedAppName} v${normalizedVersion}`);
      const res = await fetch(ep, { headers: { Authorization: authHeader } });
      if (res.ok) {
        const data = (await res.json()) as any;
        return parseAccessGroupResults(data);
      }
    } catch { /* try next endpoint */ }
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
