/**
 * http-client-utils.ts — Simple HTTP utilities for internal use.
 * DRY: Eliminates raw http.request() boilerplate occurrences.
 * [v4.0] Refactored to use globalThis.fetch (proxy-patched) instead of raw http.request().
 * All calls now go through the global fetch patch → proxy-compliant.
 */

export interface HttpPostOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Generic JSON HTTP request via fetch (proxy-patched by global-fetch-patch.ts).
 * Rejects with HttpError on 4xx/5xx status codes.
 * Resolves with parsed response body on 2xx/3xx.
 */
async function httpRequestJson<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
  options: HttpPostOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, options.headers || {});

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || 30000),
  });

  const text = await response.text();

  if (response.status >= 400) {
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const rawError = parsed?.error ?? text.slice(0, 200);
    const errMsg = formatErrorPayload(rawError);
    const err = new Error(`HTTP ${response.status}: ${errMsg}`);
    (err as any).status = response.status;
    (err as any).body = parsed;
    throw err;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`HTTP parse error: ${(e as Error).message} — body: ${text.slice(0, 200)}`);
  }
}

/** POST JSON to a URL, return parsed response body. */
export function httpPostJson<T = unknown>(
  url: string,
  body: unknown,
  options: HttpPostOptions = {}
): Promise<T> {
  return httpRequestJson<T>("POST", url, body, options);
}

/** GET from a URL, return parsed response body. */
export function httpGetJson<T = unknown>(
  url: string,
  options: HttpPostOptions = {}
): Promise<T> {
  return httpRequestJson<T>("GET", url, undefined, options);
}

/** PUT JSON to a URL, return parsed response body. */
export function httpPutJson<T = unknown>(
  url: string,
  body: unknown,
  options: HttpPostOptions = {}
): Promise<T> {
  return httpRequestJson<T>("PUT", url, body, options);
}

/** DELETE from a URL, return parsed response body. */
export function httpDeleteJson<T = unknown>(
  url: string,
  options: HttpPostOptions = {}
): Promise<T> {
  return httpRequestJson<T>("DELETE", url, undefined, options);
}

/**
 * Render an error payload into a human-readable message.
 * Backend error envelopes may carry `error` either as a string or as an object
 * (e.g. `{ code, message }` from the Knowledge service) — never surface
 * `[object Object]` for the latter.
 */
function formatErrorPayload(rawError: unknown): string {
  if (typeof rawError === "string") { return rawError; }
  if (rawError && typeof rawError === "object") {
    const msg = (rawError as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) { return msg; }
    try { return JSON.stringify(rawError); } catch { return String(rawError); }
  }
  return String(rawError ?? "");
}
