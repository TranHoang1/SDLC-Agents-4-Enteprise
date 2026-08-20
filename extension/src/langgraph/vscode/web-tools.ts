/**
 * SA4E-184 — Web tools (extension-native, in-process).
 * Provides web_search + fetch_url running directly in Extension Host.
 * Uses DuckDuckGo public API (no external service deployment needed).
 * 10-min search cache, 5-min fetch cache.
 */

/** Simple TTL cache with max entries. */
class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number, private maxEntries: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) { this.store.delete(key); return undefined; }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

const searchCache = new TtlCache<string>(10 * 60 * 1000, 300);
const fetchCache = new TtlCache<string>(5 * 60 * 1000, 200);
const TIMEOUT_MS = 15000;

/** Execute a web tool by name. Returns JSON string result. */
export async function executeWebTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "web_search": return webSearch(args);
    case "fetch_url": return fetchUrl(args);
    default: return JSON.stringify({ error: `Unknown web tool: ${name}` });
  }
}

/** Check if tool name is a web tool. */
export function isWebTool(name: string): boolean {
  return name === "web_search" || name === "fetch_url";
}

/** web_search — DuckDuckGo public API (in-process, no external service) */
async function webSearch(args: Record<string, unknown>): Promise<string> {
  const query = (args.query as string || "").trim();
  if (!query) return JSON.stringify({ error: "INVALID_INPUT", message: "query is required" });

  const numResults = Math.min((args.num_results as number) || 5, 10);
  const key = `${numResults}::${query.toLowerCase()}`;

  const cached = searchCache.get(key);
  if (cached) return cached;

  try {
    const results = await searchDuckDuckGo(query, numResults);
    const output = JSON.stringify({ results, total_found: results.length, source: "duckduckgo" });
    searchCache.set(key, output);
    return output;
  } catch (err) {
    return JSON.stringify({ error: "SEARCH_FAILED", message: (err as Error).message });
  }
}

/** fetch_url — fetch and extract text from web page (in-process) */
async function fetchUrl(args: Record<string, unknown>): Promise<string> {
  const url = args.url as string;
  if (!url) return JSON.stringify({ error: "INVALID_INPUT", message: "url is required" });

  const mode = (args.mode as string) || "full";
  const maxLength = (args.max_length as number) || 50000;
  const key = `${mode}::${url}`;

  const cached = fetchCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Kiro-Agent/1.0" },
      redirect: "follow",
    });

    if (!res.ok) {
      return JSON.stringify({ error: "HTTP_ERROR", status: res.status, message: res.statusText });
    }

    const html = await res.text();
    const text = stripHtml(html);
    const content = text.slice(0, maxLength);
    const title = extractTitle(html);

    const output = JSON.stringify({
      content, title, url: res.url,
      metadata: { status: res.status, truncated: text.length > maxLength, original_length: text.length },
    });
    fetchCache.set(key, output);
    return output;
  } catch (err) {
    return JSON.stringify({ error: "FETCH_FAILED", message: (err as Error).message });
  }
}

/** DuckDuckGo Lite search — POST to lite.duckduckgo.com (no CAPTCHA, in-process) */
async function searchDuckDuckGo(
  query: string, num: number
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: `q=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);

  const html = await res.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // DDG Lite: results are <a rel="nofollow" href="https://..."> followed by <td> with snippet
  const urlPattern = /<a[^>]+rel="nofollow"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]*)<\/a>/g;
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([^<]*)/g;

  let urlMatch: RegExpExecArray | null;
  const urls: Array<{ url: string; title: string }> = [];
  while ((urlMatch = urlPattern.exec(html)) !== null) {
    urls.push({ url: urlMatch[1], title: urlMatch[2].trim() || urlMatch[1] });
  }

  // Collect snippets
  const snippets: string[] = [];
  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    snippets.push(snippetMatch[1].trim());
  }

  for (let i = 0; i < Math.min(urls.length, num); i++) {
    results.push({
      title: urls[i].title || urls[i].url,
      url: urls[i].url,
      snippet: snippets[i] || "",
    });
  }

  return results;
}

/** Strip HTML tags → plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}
