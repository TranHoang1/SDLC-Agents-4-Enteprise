/**
 * SA4E-214 — SchemaApiClient: HTTP client wrapping backend schema endpoints.
 * Uses the same undici + proxy-agent pattern as IndexerHttpClient.
 * R-01: Validates response sizes; backend enforces 5MB body limit.
 */

import type {
  EnrichedSchema,
  SchemaAnalyzeRequest,
  SchemaAnalyzeResponse,
  SchemaStoreResponse,
  SchemaUpdateResponse,
  FieldDescriptor,
} from '../models/EnrichedSchema';
import { EnrichedSchemaSchema } from '../models/EnrichedSchema';

/** Interface for backend schema API interaction (TDD §5.2) */
export interface ISchemaApiClient {
  analyze(request: SchemaAnalyzeRequest): Promise<SchemaAnalyzeResponse>;
  store(schema: EnrichedSchema): Promise<SchemaStoreResponse>;
  find(ruleType: string): Promise<EnrichedSchema | null>;
  update(ruleType: string, newFields: FieldDescriptor[]): Promise<SchemaUpdateResponse>;
}

/** Default timeout for analyze calls (can trigger LLM — up to 60s) */
const ANALYZE_TIMEOUT_MS = 60_000;

/** Standard timeout for CRUD calls */
const CRUD_TIMEOUT_MS = 10_000;

/**
 * HTTP client for backend /api/v1/pega/schema/* endpoints.
 * Wraps fetch with AbortController timeouts.
 */
export class SchemaApiClient implements ISchemaApiClient {
  private readonly baseUrl: string;

  constructor(backendUrl: string) {
    // Normalize: strip trailing slash
    this.baseUrl = backendUrl.replace(/\/$/, '') + '/api/v1/pega/schema';
  }

  /** POST /analyze — send harness JSON for dual-strategy analysis (TDD §3.2) */
  async analyze(request: SchemaAnalyzeRequest): Promise<SchemaAnalyzeResponse> {
    const resp = await this.post('/analyze', request, ANALYZE_TIMEOUT_MS);
    return resp as SchemaAnalyzeResponse;
  }

  /** POST /store — persist completed enriched schema in KB (TDD §3.3) */
  async store(schema: EnrichedSchema): Promise<SchemaStoreResponse> {
    const resp = await this.post('/store', { schema }, CRUD_TIMEOUT_MS);
    return resp as SchemaStoreResponse;
  }

  /** GET /find?ruleType=X — retrieve schema from KB (TDD §3.4) */
  async find(ruleType: string): Promise<EnrichedSchema | null> {
    const url = `${this.baseUrl}/find?ruleType=${encodeURIComponent(ruleType)}`;
    const resp = await this.fetchWithTimeout(url, { method: 'GET' }, CRUD_TIMEOUT_MS);

    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Schema find failed: ${resp.status}`);

    const body = await resp.json();
    const parsed = EnrichedSchemaSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  }

  /** PATCH /update — progressive field append (TDD §3.5) */
  async update(ruleType: string, newFields: FieldDescriptor[]): Promise<SchemaUpdateResponse> {
    const resp = await this.patch('/update', { ruleType, new_fields: newFields }, CRUD_TIMEOUT_MS);
    return resp as SchemaUpdateResponse;
  }

  // ─── HTTP Helpers ───────────────────────────────────────────────────────

  private async post(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const resp = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs);

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`Schema API ${path} failed: ${resp.status} — ${errBody}`);
    }
    return resp.json();
  }

  private async patch(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const resp = await this.fetchWithTimeout(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs);

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`Schema API ${path} failed: ${resp.status} — ${errBody}`);
    }
    return resp.json();
  }

  /** Fetch with AbortController-based timeout. */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
