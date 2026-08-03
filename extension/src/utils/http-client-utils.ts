/**
 * http-client-utils.ts — Simple HTTP utilities for internal use.
 * DRY: Eliminates raw http.request() boilerplate occurrences.
 * [v3.1] Added PUT/DELETE support for the Backend Knowledge API.
 */
import * as http from "http";
import * as https from "https";

export interface HttpPostOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Generic JSON HTTP request via Node http/https module.
 * Compatible with older VS Code environments (no global fetch dependency).
 * Resolves with the parsed response body regardless of status code —
 * callers check the backend `{ data, error }` envelope.
 */
function httpRequestJson<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
  options: HttpPostOptions = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {};
    if (payload !== null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload).toString();
    }
    Object.assign(headers, options.headers || {});
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          try { resolve(JSON.parse(data) as T); }
          catch (e) { reject(new Error(`HTTP parse error: ${(e as Error).message} — body: ${data.slice(0, 200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(options.timeoutMs || 30000, () => {
      req.destroy();
      reject(new Error(`HTTP ${method} timeout after ${options.timeoutMs || 30000}ms`));
    });
    if (payload !== null) { req.write(payload); }
    req.end();
  });
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
