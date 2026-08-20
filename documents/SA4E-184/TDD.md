# Technical Design Document (TDD)

## SA4E-184 — WebModule: Internet/Network Tools

| Field | Value |
|-------|-------|
| Ticket | SA4E-184 |
| Related BRD | BRD-v1-SA4E-184.docx |
| Related FSD | FSD-v1-SA4E-184.docx |
| Related TDD | TDD-v1-SA4E-184.docx |
| Version | 1 |

---

## 1. Architecture Overview

WebModule follows the standard module pattern in the Code Intelligence backend:
- Implements `IModule` interface (initialize/shutdown/getToolHandlers/getToolDefinitions)
- Uses **Strategy pattern** for handler dispatch (each tool = independent handler class)
- Uses **Decorator/Middleware pattern** for cross-cutting concerns (SSRF, rate limit, truncation)
- Uses **Template Method pattern** implicitly (each handler: validate → guard → rate limit → execute → format)

### 1.1 Module Boundaries

```
IModule (interface)
  └── WebModule (orchestrator)
        ├── Middleware Layer
        │     ├── SsrfGuard (security)
        │     ├── RateLimiter (performance)
        │     └── ContentTruncator (resource)
        ├── Handler Layer (strategy per tool)
        │     ├── WebSearchHandler
        │     ├── FetchUrlHandler
        │     ├── GitBrowseHandler
        │     ├── DownloadFileHandler
        │     ├── ApiCallHandler
        │     └── ReadWebpageHandler
        ├── Utils Layer
        │     ├── UrlValidator
        │     ├── HtmlExtractor
        │     ├── GitUrlParser
        │     └── ResponseCache<T>
        └── Models Layer
              ├── WebModuleConfig
              ├── WebToolError (+ WebErrorCode)
              └── WebToolResult (successResult/errorResult)
```

---

## 2. Component Design

### 2.1 WebModule (Entry Point)

| Responsibility | Detail |
|---------------|--------|
| Lifecycle | Initialize middleware + handlers; shutdown browser |
| Tool Registry | Maps tool names → handler functions |
| Config Loading | Reads env vars via `loadWebConfig()` |

**Composition at init:**
```typescript
ssrfGuard = new SsrfGuard(config.ssrfBlocklist)
rateLimiter = new RateLimiter(config.rateLimitRpm)
contentTruncator = new ContentTruncator(config.maxResponseKb)
// Each handler receives only the middleware it needs
```

### 2.2 Middleware Components

#### SsrfGuard
- **Purpose**: Prevent server-side request forgery
- **Algorithm**: Parse URL → validate protocol → resolve DNS → check IP ranges
- **IPv4 ranges blocked**: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0
- **IPv6 ranges blocked**: ::1, fc00::/7, fe80::/10
- **Dependency**: `dns/promises`, `net` (Node.js stdlib)

#### RateLimiter
- **Purpose**: Token bucket rate limiting per tool
- **Algorithm**: Independent bucket per tool name; refill rate = RPM/60000 tokens/ms
- **Methods**: `consume(tool)` → ConsumeResult; `consumeOrThrow(tool)` → void or WebToolError

#### ContentTruncator
- **Purpose**: Limit response size
- **Algorithm**: Slice string to maxBytes; report truncation status

### 2.3 Handler Components

| Handler | Middleware Used | Cache | External Dep |
|---------|----------------|-------|--------------|
| WebSearchHandler | RateLimiter | 10 min, 300 entries | SearXNG, DuckDuckGo |
| FetchUrlHandler | SsrfGuard, RateLimiter, ContentTruncator | 5 min, 200 entries | fetch API |
| GitBrowseHandler | RateLimiter | None | GitHub/GitLab API |
| DownloadFileHandler | SsrfGuard, RateLimiter | None | fetch + fs stream |
| ApiCallHandler | SsrfGuard, RateLimiter, ContentTruncator | None | fetch API |
| ReadWebpageHandler | SsrfGuard, RateLimiter, ContentTruncator | None | Playwright |

### 2.4 Utility Components

#### ResponseCache\<T\>
- Generic TTL cache with LRU eviction
- `get(key)`: returns value or undefined (auto-evicts expired)
- `set(key, value)`: stores with TTL, evicts LRU on overflow
- Thread-safe (single-threaded Node.js, no mutex needed)

#### HtmlExtractor
- `toText(html)`: strips scripts/styles/tags, preserves line breaks
- `extractBySelector(html, selector)`: regex-based CSS selector extraction
- Supports: `.class`, `#id`, `tagname` selectors

#### UrlValidator
- `validateUrl(str)`: returns URL object or throws WebToolError
- Checks: non-empty, parseable, protocol in {http, https}

#### GitUrlParser
- `parseGitUrl(url)`: extracts host, owner, repo, path, ref
- Supports: github.com, gitlab.com
- Handles `/blob/{ref}/{path}` and `/tree/{ref}/{path}` URL patterns

---

## 3. Error Handling Strategy

### 3.1 Error Type Hierarchy

```
Error (base)
  └── WebToolError
        ├── code: WebErrorCode (discriminant)
        ├── message: string (human-readable)
        └── details?: Record<string, unknown> (optional metadata)
```

### 3.2 Error Propagation

All handlers follow the same pattern:
```typescript
try {
  // validate → guard → rate limit → execute
  return successResult(data);
} catch (err) {
  if (err instanceof WebToolError) return errorResult(err);
  return errorResult(new WebToolError('TIMEOUT', err.message));
}
```

- Known errors → preserve error code
- Unknown errors → wrap as TIMEOUT (generic external failure)

### 3.3 Result Type

```typescript
// ToolResult = MCP standard
{ content: [{ type: 'text', text: string }], isError: boolean }
```

- `successResult(data)`: JSON.stringify with pretty-print, isError=false
- `errorResult(err)`: JSON with error code + message, isError=true

---

## 4. Security Design

### 4.1 SSRF Protection (Multi-layer)

| Layer | Check | Blocks |
|-------|-------|--------|
| 1. Protocol | URL.protocol ∈ {http, https} | file://, ftp://, javascript: |
| 2. DNS Resolution | Resolve hostname → IP | DNS rebinding (resolve first) |
| 3. IP Blocklist | Check resolved IP against ranges | Internal networks |

### 4.2 Path Traversal Prevention

DownloadFileHandler:
```typescript
const resolved = path.resolve(workspace, filename);
if (!resolved.startsWith(workspace)) throw INVALID_URL;
```

### 4.3 Extension Blocklist

Blocked: `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.msi`, `.scr`

### 4.4 Input Validation

Every handler validates required args before any network activity.

---

## 5. Performance Design

### 5.1 Caching Strategy

| Cache | TTL | Max Entries | Eviction |
|-------|-----|-------------|----------|
| WebSearchHandler | 10 min | 300 | LRU |
| FetchUrlHandler | 5 min | 200 | LRU |

Cache key design prevents collisions:
- Search: `${lang}::${cat}::${num}::${query.toLowerCase().trim()}`
- Fetch: `${mode}::${selector}::${url}`

### 5.2 Rate Limiting

Token bucket algorithm:
- Capacity = RPM (default 10)
- Refill rate = RPM / 60000 tokens/ms
- Per-tool isolation (web_search bucket separate from fetch_url)
- Burst allowed up to full capacity

### 5.3 Resource Management

- Browser: lazy-loaded (first `read_webpage` call)
- Browser contexts: counted, hard-capped at 3
- Contexts always closed in `finally` block

---

## 6. File Structure

```
backend/src/modules/web/
├── WebModule.ts                    # IModule implementation, tool registry
├── handlers/
│   ├── WebSearchHandler.ts         # web_search tool
│   ├── FetchUrlHandler.ts          # fetch_url tool
│   ├── GitBrowseHandler.ts         # git_clone_browse tool
│   ├── DownloadFileHandler.ts      # download_file tool
│   ├── ApiCallHandler.ts           # api_call tool
│   └── ReadWebpageHandler.ts       # read_webpage tool
├── middleware/
│   ├── SsrfGuard.ts               # SSRF protection
│   ├── RateLimiter.ts             # Token bucket rate limiter
│   └── ContentTruncator.ts        # Response size limiter
├── models/
│   ├── WebModuleConfig.ts         # Configuration interface + loader
│   ├── WebError.ts                # Error types
│   └── WebToolResult.ts           # Result helpers
├── utils/
│   ├── UrlValidator.ts            # URL validation
│   ├── HtmlExtractor.ts           # HTML → text extraction
│   ├── GitUrlParser.ts            # Git URL parsing
│   └── ResponseCache.ts           # Generic TTL cache
└── __tests__/
    ├── fetch-url-handler.test.ts  # FetchUrlHandler unit tests
    ├── web-utils.test.ts          # Utility unit tests
    └── web-search-handler.test.ts # WebSearchHandler unit tests (TO CREATE)
```

---

## 7. Implementation Checklist

| # | Task | File | Status |
|---|------|------|--------|
| 1 | WebModule entry point | WebModule.ts | ✅ Done |
| 2 | WebSearchHandler | handlers/WebSearchHandler.ts | ✅ Done |
| 3 | FetchUrlHandler | handlers/FetchUrlHandler.ts | ✅ Done |
| 4 | GitBrowseHandler | handlers/GitBrowseHandler.ts | ✅ Done |
| 5 | DownloadFileHandler | handlers/DownloadFileHandler.ts | ✅ Done |
| 6 | ApiCallHandler | handlers/ApiCallHandler.ts | ✅ Done |
| 7 | ReadWebpageHandler | handlers/ReadWebpageHandler.ts | ✅ Done |
| 8 | SsrfGuard | middleware/SsrfGuard.ts | ✅ Done |
| 9 | RateLimiter | middleware/RateLimiter.ts | ✅ Done |
| 10 | ContentTruncator | middleware/ContentTruncator.ts | ✅ Done |
| 11 | WebModuleConfig | models/WebModuleConfig.ts | ✅ Done |
| 12 | WebError | models/WebError.ts | ✅ Done |
| 13 | WebToolResult | models/WebToolResult.ts | ✅ Done |
| 14 | UrlValidator | utils/UrlValidator.ts | ✅ Done |
| 15 | HtmlExtractor | utils/HtmlExtractor.ts | ✅ Done |
| 16 | GitUrlParser | utils/GitUrlParser.ts | ✅ Done |
| 17 | ResponseCache | utils/ResponseCache.ts | ✅ Done |
| 18 | FetchUrlHandler tests | __tests__/fetch-url-handler.test.ts | ✅ Done |
| 19 | Utils tests | __tests__/web-utils.test.ts | ✅ Done |
| 20 | **WebSearchHandler tests** | __tests__/web-search-handler.test.ts | ❌ Missing |

---

## 8. Testing Strategy

### 8.1 Unit Tests Required

| Test File | Handler/Component | Approach |
|-----------|------------------|----------|
| fetch-url-handler.test.ts | FetchUrlHandler | ✅ Mock global fetch, fake SsrfGuard |
| web-utils.test.ts | UrlValidator, HtmlExtractor, GitUrlParser, ResponseCache | ✅ Pure function tests |
| **web-search-handler.test.ts** | WebSearchHandler | Mock global fetch, verify SearXNG → DDG fallback, caching, rate limiting |

### 8.2 Test Pattern (from existing tests)

```typescript
// 1. Create config object with test values
// 2. Mock global fetch with vi.stubGlobal
// 3. Create handler with real RateLimiter (high RPM to not interfere)
// 4. Test success paths, error paths, caching behavior
// 5. Cleanup in afterEach
```

---

## Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
