# Functional Specification Document (FSD)

## SA4E-184 — WebModule: Internet/Network Tools

| Field | Value |
|-------|-------|
| Ticket | SA4E-184 |
| Related BRD | BRD-v1-SA4E-184.docx |
| Related FSD | FSD-v1-SA4E-184.docx |
| Version | 1 |

---

## 1. Introduction

This document specifies the functional design of WebModule — a set of 6 internet/network tools exposed via MCP protocol. The module integrates into the Code Intelligence backend as an `IModule` implementation.

---

## 2. Use Cases

### UC-01: Web Search

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Precondition | Module initialized, SearXNG reachable |
| Trigger | Agent calls `web_search` tool |

**Main Flow:**
1. Agent provides query string (required), optional: num_results, category, language, no_cache
2. System validates query is non-empty
3. System checks in-memory cache (key: `lang::category::num::query`)
4. If cache hit and no_cache=false → return cached result
5. System consumes rate limiter token for `web_search`
6. System calls SearXNG `/search?q={query}&format=json&categories={cat}&language={lang}`
7. System maps results to `{title, url, snippet}[]`, sliced to num_results
8. System caches result (TTL: 10 min)
9. System returns `{results, total_found, search_engine}`

**Alternative Flow — SearXNG Failure (AF-01.1):**
- At step 6, if SearXNG returns non-200 or throws → system falls back to DuckDuckGo API
- DuckDuckGo URL: `https://api.duckduckgo.com/?q={query}&format=json&no_html=1`
- Maps `RelatedTopics[].{Text, FirstURL}` to search results

**Exception Flow — Rate Limited (EF-01.1):**
- At step 5, if token bucket empty → throw `RATE_LIMITED` error with resetMs

**Exception Flow — Empty Query (EF-01.2):**
- At step 2, if query is empty → throw `INVALID_URL` error

---

### UC-02: Fetch URL

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Precondition | Module initialized |
| Trigger | Agent calls `fetch_url` tool |

**Main Flow:**
1. Agent provides url (required), optional: mode (full/truncated/selective), max_length, selector, no_cache
2. System validates URL format and protocol (http/https only)
3. System runs SSRF guard: resolves DNS → checks IP against blocklist
4. System checks cache (key: `mode::selector::url`)
5. If cache hit → return cached
6. System consumes rate limiter token for `fetch_url`
7. System fetches URL with timeout and user-agent header
8. System processes content based on mode:
   - `full`: strip HTML → plain text
   - `truncated`: strip HTML → plain text → slice to max_length
   - `selective`: extract by CSS selector → plain text
9. System truncates content if exceeding maxResponseKb
10. System returns `{content, metadata: {status_code, content_type, title, truncated, url, cached}}`

**Exception Flow — SSRF Blocked (EF-02.1):**
- At step 3, private IP detected → throw `SSRF_BLOCKED`

**Exception Flow — Invalid URL (EF-02.2):**
- At step 2, malformed URL or blocked protocol → throw `INVALID_URL`

**Exception Flow — Timeout (EF-02.3):**
- Fetch exceeds timeoutMs → throw `TIMEOUT`

---

### UC-03: Git Clone Browse

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Precondition | Module initialized |
| Trigger | Agent calls `git_clone_browse` tool |

**Main Flow:**
1. Agent provides repo_url (required), optional: operation (readme/tree/read_file), path, ref, token
2. System consumes rate limiter token
3. System parses URL → extracts host, owner, repo
4. System routes to GitHub or GitLab handler based on host
5. System constructs API URL based on operation:
   - `readme`: `/repos/{owner}/{repo}/readme` (GH) or `/files/README.md/raw` (GL)
   - `tree`: `/git/trees/{ref}?recursive=1` (GH) or `/tree?recursive=true` (GL)
   - `read_file`: `/contents/{path}?ref={ref}` (GH) or `/files/{path}/raw` (GL)
6. System makes API request with optional auth token
7. System returns structured result

**Exception Flow — Unsupported Host (EF-03.1):**
- Only github.com and gitlab.com supported → throw `INVALID_URL`

**Exception Flow — Not Found (EF-03.2):**
- API returns 404 → throw `DNS_FAILED` (repo/file not found)

---

### UC-04: Download File

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Precondition | Module initialized |
| Trigger | Agent calls `download_file` tool |

**Main Flow:**
1. Agent provides url (required), optional: dest_path, overwrite
2. System validates URL → SSRF guard → rate limit
3. System resolves filename from dest_path or URL basename
4. System validates file extension against blocklist
5. System resolves full path within workspace (path traversal check)
6. System streams response body to file (pipeline)
7. System checks content-length against maxDownloadMb
8. System returns `{path, filename, size, content_type}`

**Exception Flow — Blocked Extension (EF-04.1):**
- `.exe`, `.bat`, etc. → throw `BLOCKED_EXTENSION`

**Exception Flow — Path Traversal (EF-04.2):**
- Resolved path outside workspace → throw `INVALID_URL`

**Exception Flow — File Too Large (EF-04.3):**
- Content-Length exceeds limit → throw `CONTENT_TOO_LARGE`

---

### UC-05: API Call

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Precondition | Module initialized |
| Trigger | Agent calls `api_call` tool |

**Main Flow:**
1. Agent provides url (required), optional: method, headers, body, timeout
2. System validates: URL, method in allowed set, timeout ≤ 60s
3. System runs SSRF guard → rate limit
4. System constructs request (auto Content-Type for JSON body)
5. System executes fetch with configured options
6. System reads response text, truncates if needed
7. System returns `{status, headers, body, elapsed_ms}`

**Exception Flow — Invalid Method (EF-05.1):**
- Method not in GET/POST/PUT/DELETE/PATCH → throw `INVALID_URL`

---

### UC-06: Read Webpage (Playwright)

| Field | Value |
|-------|-------|
| Actor | AI Agent |
| Precondition | Module initialized, Playwright installed |
| Trigger | Agent calls `read_webpage` tool |

**Main Flow:**
1. Agent provides url (required), optional: wait_for, selector, timeout, block_resources
2. System validates URL → SSRF guard → rate limit
3. System checks active browser contexts < max (3)
4. System launches/reuses headless Chromium browser
5. System creates new context with user-agent
6. System blocks specified resource types (images, fonts, media)
7. System navigates to URL with wait strategy
8. System extracts content (selector or full body text)
9. System truncates content
10. System closes context, decrements counter
11. System returns `{content, title, url, metadata: {partial}}`

**Exception Flow — Max Contexts (EF-06.1):**
- Active contexts ≥ max → throw `RATE_LIMITED`

**Exception Flow — Browser Failed (EF-06.2):**
- Playwright error → throw `BROWSER_FAILED`

---

## 3. Business Rules

| ID | Rule | Implementation |
|----|------|----------------|
| BR-01 | SSRF validation before all external requests | SsrfGuard.validate() resolves DNS then checks IP |
| BR-02 | Private IPs blocked | SsrfGuard.isPrivateIp() for IPv4/IPv6 ranges |
| BR-03 | Per-tool token bucket rate limiting | RateLimiter with independent buckets per tool name |
| BR-04 | Default 10 RPM | Configurable via WEB_RATE_LIMIT_RPM env var |
| BR-05 | 30s default timeout | Configurable via WEB_TIMEOUT_MS env var |
| BR-06 | Content truncation at 100KB | ContentTruncator with WEB_MAX_RESPONSE_KB |
| BR-07 | Blocked extensions for downloads | DownloadFileHandler.validateExtension() |
| BR-08 | Workspace boundary enforcement | DownloadFileHandler.resolvePath() |
| BR-09 | http/https only protocols | UrlValidator + SsrfGuard.checkProtocol() |
| BR-10 | Search cache 10 min, fetch cache 5 min | ResponseCache instances with different TTLs |
| BR-11 | Max 3 browser contexts | ReadWebpageHandler.activeContexts counter |

---

## 4. Data Specifications

### 4.1 WebModuleConfig Interface

| Property | Type | Default | Source |
|----------|------|---------|--------|
| searxngUrl | string | `http://localhost:8080` | WEB_SEARXNG_URL |
| rateLimitRpm | number | 10 | WEB_RATE_LIMIT_RPM |
| timeoutMs | number | 30000 | WEB_TIMEOUT_MS |
| maxResponseKb | number | 100 | WEB_MAX_RESPONSE_KB |
| maxDownloadMb | number | 50 | WEB_MAX_DOWNLOAD_MB |
| maxBrowserContexts | number | 3 | WEB_MAX_BROWSER_CONTEXTS |
| blockedExtensions | string[] | .exe,.bat,.cmd,.ps1,.sh,.msi,.scr | Hardcoded |
| ssrfBlocklist | string[] | RFC 1918 + link-local | Hardcoded |
| userAgent | string | `Kiro-WebModule/1.0` | WEB_USER_AGENT |
| workspace | string | — | From appConfig |

### 4.2 Error Codes

| Code | HTTP Analogy | Meaning |
|------|-------------|---------|
| SSRF_BLOCKED | 403 | Internal/private IP detected |
| RATE_LIMITED | 429 | Token bucket exhausted |
| TIMEOUT | 504 | Request exceeded timeout |
| CONTENT_TOO_LARGE | 413 | Response exceeds max size |
| INVALID_URL | 400 | Malformed URL or blocked protocol |
| DNS_FAILED | 502 | Cannot resolve hostname |
| BLOCKED_EXTENSION | 403 | Dangerous file extension |
| BROWSER_FAILED | 500 | Playwright error |

---

## 5. API Specifications (MCP Tools)

### 5.1 web_search

```json
{
  "name": "web_search",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "num_results": { "type": "number", "description": "Max results (1-10, default 5)" },
      "category": { "type": "string", "description": "Search category (default: general)" },
      "language": { "type": "string", "description": "Language code (default: en)" }
    },
    "required": ["query"]
  }
}
```

### 5.2 fetch_url

```json
{
  "name": "fetch_url",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "mode": { "type": "string", "enum": ["full", "truncated", "selective"] },
      "max_length": { "type": "number" },
      "selector": { "type": "string" }
    },
    "required": ["url"]
  }
}
```

### 5.3 git_clone_browse

```json
{
  "name": "git_clone_browse",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repo_url": { "type": "string" },
      "operation": { "type": "string", "enum": ["readme", "tree", "read_file"] },
      "path": { "type": "string" },
      "ref": { "type": "string" },
      "token": { "type": "string" }
    },
    "required": ["repo_url"]
  }
}
```

### 5.4 download_file

```json
{
  "name": "download_file",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "dest_path": { "type": "string" },
      "overwrite": { "type": "boolean" }
    },
    "required": ["url"]
  }
}
```

### 5.5 api_call

```json
{
  "name": "api_call",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"] },
      "headers": { "type": "object" },
      "body": {},
      "timeout": { "type": "number" }
    },
    "required": ["url"]
  }
}
```

### 5.6 read_webpage

```json
{
  "name": "read_webpage",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "wait_for": { "type": "string", "enum": ["networkidle", "load", "domcontentloaded", "selector"] },
      "selector": { "type": "string" },
      "timeout": { "type": "number" },
      "block_resources": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["url"]
  }
}
```

---

## 6. Integration Requirements

### 6.1 Module Registration

WebModule implements `IModule` interface:
- `initialize()`: loads config, creates middleware instances, creates handler instances
- `shutdown()`: closes Playwright browser
- `getToolHandlers()`: returns Map<string, ToolHandler> with 6 tools
- `getToolDefinitions()`: returns ToolDefinition[] for MCP tool listing

### 6.2 External Service Integration

| Service | Protocol | Auth | Timeout |
|---------|----------|------|---------|
| SearXNG | HTTP GET | None | configurable |
| DuckDuckGo | HTTP GET | None | configurable |
| GitHub API | HTTP GET | Bearer token (optional) | configurable |
| GitLab API | HTTP GET | Bearer token (optional) | configurable |
| Arbitrary URL | HTTP * | Custom headers | configurable |

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Startup time (module init) | < 100ms (no browser launch at init) |
| NFR-02 | Memory (caches) | < 50MB under normal load |
| NFR-03 | Concurrent browser contexts | Max 3 (configurable) |
| NFR-04 | Rate limit accuracy | ±1 request tolerance over 60s window |

---

## Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Web Search | [sequence-web-search.png](diagrams/sequence-web-search.png) | [sequence-web-search.drawio](diagrams/sequence-web-search.drawio) |
| 3 | State — Request Lifecycle | [state-request.png](diagrams/state-request.png) | [state-request.drawio](diagrams/state-request.drawio) |
