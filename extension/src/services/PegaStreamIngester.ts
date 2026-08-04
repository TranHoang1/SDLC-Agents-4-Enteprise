/**
 * PegaStreamIngester — NDJSON streaming ingest client for Pega rules.
 * Sends rules one-by-one as newline-delimited JSON via chunked HTTP POST.
 * Never holds entire batch in memory on the wire — O(1) per-rule overhead.
 * Fixes SA4E-92: backend OOM from bulk 10KB×1000 rule payloads.
 */

/** Result returned by backend after processing the NDJSON stream */
export interface StreamIngestResult {
  stored: number;
  totalRulesInDb?: number;
  totalKbEntriesInDb?: number;
  totalGraphNodesInDb?: number;
  nextBatch?: Array<{ insKey: string; pxObjClass: string; pyClassName: string; pyRuleName: string }>;
}

/** Metadata line sent as first NDJSON record */
interface StreamMetadata {
  __meta: true;
  projectId: string;
  checksums: Record<string, string>;
  versions: Record<string, string>;
  visitedKeys: string[];
}

type LogFn = (msg: string) => void;

/**
 * Stream rules to backend via NDJSON HTTP POST with ReadableStream body.
 * Uses chunked transfer encoding — backend processes line-by-line.
 */
export class PegaStreamIngester {
  private readonly backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  /**
   * Stream all rules in a single NDJSON request.
   * First line = metadata (projectId, checksums, versions, visitedKeys).
   * Subsequent lines = one rule JSON object per line.
   */
  async streamIngest(
    rules: Record<string, unknown>[],
    projectId: string,
    checksums: Record<string, string>,
    versions: Record<string, string>,
    visitedKeys: string[],
    log: LogFn,
  ): Promise<StreamIngestResult> {
    const endpoint = `${this.backendUrl}/api/v1/pega/ingest-stream`;
    log(`[Pega Ingester] 🌊 Streaming ${rules.length} rules via NDJSON to ${endpoint}`);

    const body = this.buildNdjsonBody(rules, projectId, checksums, versions, visitedKeys);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ingest stream failed: HTTP ${res.status} — ${text}`);
    }

    const json = (await res.json()) as { data?: StreamIngestResult; error?: unknown };
    log(`[Pega Ingester] ✅ Stream complete: ${json.data?.stored ?? 0} rules stored`);
    return json.data ?? { stored: 0 };
  }

  /** Build NDJSON string body — one JSON line per rule. Backend processes line-by-line. */
  private buildNdjsonBody(
    rules: Record<string, unknown>[],
    projectId: string,
    checksums: Record<string, string>,
    versions: Record<string, string>,
    visitedKeys: string[],
  ): string {
    const meta: StreamMetadata = { __meta: true, projectId, checksums, versions, visitedKeys };
    const lines: string[] = [JSON.stringify(meta)];
    for (const rule of rules) {
      lines.push(JSON.stringify(rule));
    }
    return lines.join("\n") + "\n";
  }
}
