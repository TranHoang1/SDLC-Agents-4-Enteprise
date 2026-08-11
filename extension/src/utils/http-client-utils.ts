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
 * Rejects with HttpError on 4xx/5xx status codes.
 * Resolves with parsed response body on 2xx/3xx.
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
          const status = res.statusCode ?? 0;
          try {
            const parsed = JSON.parse(data) as T;
            if (status >= 400) {
              const err = new Error(`HTTP ${status}: ${(parsed as any)?.error ?? data.slice(0, 100)}`);
              (err as any).status = status;
              (err as any).body = parsed;
              reject(err);
            } else {
              resolve(parsed);
            }
          } catch (e) {
            if (status >= 400) {
              const err = new Error(`HTTP ${status}: ${data.slice(0, 200)}`);
              (err as any).status = status;
              reject(err);
            } else {
              reject(new Error(`HTTP parse error: ${(e as Error).message} — body: ${data.slice(0, 200)}`));
            }
          }
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
