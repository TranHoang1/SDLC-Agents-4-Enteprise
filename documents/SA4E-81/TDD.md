# Technical Design Document (TDD)

## SDLC Agents 4 Enterprise — SA4E-PROXY: Proxy Configuration Page

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-PROXY |
| Title | Proxy Configuration Page — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | BRD-v1-SA4E-PROXY.docx |
| Related FSD | FSD-v1-SA4E-PROXY.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | SA Agent | Initial TDD |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

The proxy feature integrates into the existing VS Code extension architecture as a **cross-cutting concern**. Rather than modifying every HTTP call site, we introduce a centralized `ProxyAgentFactory` singleton that the existing `HttpClient` consumes transparently. This follows the Open/Closed Principle — existing code is extended, not modified in its core logic.

### 1.2 Integration Points

```
+---------------------------------------------------------------------+
|  Webview (settings.js + proxy-tab.js)                               |
|  +--------------+  postMessage   +------------------------------+   |
|  | Proxy Tab UI | ------------->  | SettingsMessageHandler       |   |
|  | (pane-proxy) | <-------------  | + proxy message cases        |   |
|  +--------------+                 +------------------------------+   |
|                                           |                          |
|                              +------------+------------+             |
|                              v            v            v             |
|                   +--------------+ +------------+ +------------+    |
|                   |ProxyConfig   | |ProxyDetect | |ProxyAgent  |    |
|                   |Service       | |ionService  | |Factory     |    |
|                   +--------------+ +------------+ +------------+    |
|                         |                |              |            |
|                         v                v              v            |
|                   +----------+    +----------+   +----------+       |
|                   |VS Code   |    |Env Vars  |   |undici    |       |
|                   |Config API|    |+ VS Code |   |ProxyAgent|       |
|                   |+ Secrets |    |http.proxy|   |instance  |       |
|                   +----------+    +----------+   +----------+       |
|                                                       |             |
|                              +-------------------------+            |
|                              v                                       |
|                   +----------------------+                          |
|                   | HttpClient (existing) |                          |
|                   | fetch() + dispatcher  |                          |
|                   +----------------------+                          |
+---------------------------------------------------------------------+
```

### 1.3 Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Proxy mechanism | `undici.ProxyAgent` as `fetch()` dispatcher | Node.js 20+ native `fetch()` uses undici internally; ProxyAgent is the official way to proxy via `dispatcher` option |
| HttpClient modification | Add optional `dispatcher` parameter to all fetch calls | Minimal change; single injection point via `ProxyAgentFactory.getDispatcher()` |
| Configuration scope | `Global` (not Workspace) | Proxy is user/machine-specific, not project-specific; consistent with VS Code `http.proxy` |
| Singleton pattern | `ProxyAgentFactory` as module-level singleton | Ensures all HttpClient instances share the same ProxyAgent; allows immediate reconfiguration |
| Webview JS | Separate `proxy-tab.js` file | Keeps proxy logic isolated; existing `settings.js` only gets tab-switching hook |
| Credential flow | Credentials never sent to webview | Password stays in SecretStorage; only `hasCredentials` boolean and username sent to UI |


---

## 2. Module Design

### 2.1 New Files to Create

| # | File Path | Responsibility | Lines (est.) |
|---|-----------|---------------|--------------|
| 1 | `extension/src/proxy/ProxyConfigService.ts` | Read/write proxy settings from VS Code config + SecretStorage | ~120 |
| 2 | `extension/src/proxy/ProxyDetectionService.ts` | Detect system proxy from env vars and VS Code `http.proxy` | ~80 |
| 3 | `extension/src/proxy/ProxyAgentFactory.ts` | Create/cache/invalidate undici ProxyAgent based on current config | ~130 |
| 4 | `extension/src/proxy/ProxyTestService.ts` | Test proxy connectivity using temporary ProxyAgent from form values | ~90 |
| 5 | `extension/src/proxy/ProxyMessageHandler.ts` | Handle proxy-specific webview messages (7 message types) | ~150 |
| 6 | `extension/src/models/ProxyModels.ts` | TypeScript interfaces: ProxyConfig, ProxyState, ProxyTestResult | ~50 |
| 7 | `extension/webview-assets/settings/proxy-tab.js` | Webview JS for proxy tab: form binding, validation, postMessage | ~180 |

### 2.2 Files to Modify

| # | File Path | Change Description |
|---|-----------|-------------------|
| 1 | `extension/src/proxy/HttpClient.ts` | Add `dispatcher` option to all `fetch()` calls; import ProxyAgentFactory |
| 2 | `extension/src/panels/settings/SettingsPanel.ts` | Add proxy tab HTML to `getHtml()`, add `proxy-tab.js` script tag |
| 3 | `extension/src/panels/settings/SettingsMessageHandler.ts` | Delegate proxy messages to ProxyMessageHandler (composition) |
| 4 | `extension/src/models/index.ts` | Re-export ProxyModels types |
| 5 | `extension/package.json` | Add `kiroSdlc.proxy.*` configuration contributions |
| 6 | `extension/webview-assets/settings/settings.css` | Add `.radio-group`, `.proxy-url-preview` styles |

### 2.3 Module Dependency Graph

```
ProxyMessageHandler
    |--- ProxyConfigService (read/write config)
    |--- ProxyDetectionService (detect system proxy)
    |--- ProxyTestService (test connectivity)
    |--- ProxyAgentFactory (rebuild agent after save)

ProxyAgentFactory
    |--- ProxyConfigService (read current config)
    |--- ProxyDetectionService (resolve system proxy URL)

HttpClient
    |--- ProxyAgentFactory.getDispatcher() (get current dispatcher)

ProxyTestService
    |--- (standalone: creates temp ProxyAgent from form values)
```


---

## 3. API Design (postMessage Protocol)

### 3.1 Webview -> Extension Host Messages

| Message Type | Payload | Handler Method |
|-------------|---------|----------------|
| `getProxyState` | `{}` | `handleGetProxyState()` |
| `setProxyMode` | `{ mode: ProxyMode }` | `handleSetProxyMode()` |
| `saveProxy` | `{ host: string, port: number, bypass: string }` | `handleSaveProxy()` |
| `saveProxyCredentials` | `{ username: string, password: string }` | `handleSaveProxyCredentials()` |
| `clearProxyCredentials` | `{}` | `handleClearProxyCredentials()` |
| `testProxyConnection` | `{ mode, host, port, username?, password? }` | `handleTestProxyConnection()` |
| `detectSystemProxy` | `{}` | `handleDetectSystemProxy()` |

### 3.2 Extension Host -> Webview Messages

| Message Type | Payload | Trigger |
|-------------|---------|---------|
| `proxyState` | `ProxyState` (full state object) | Response to `getProxyState` or after mode/save changes |
| `proxyModeChanged` | `{ mode: ProxyMode, success: boolean }` | After `setProxyMode` |
| `proxySaved` | `{ success: boolean, error?: string }` | After `saveProxy` |
| `proxyCredentialsSaved` | `{ success: boolean, error?: string }` | After `saveProxyCredentials` |
| `proxyCredentialsCleared` | `{ success: boolean }` | After `clearProxyCredentials` |
| `proxyTestResult` | `{ success, message, latencyMs? }` | After `testProxyConnection` |
| `systemProxyDetected` | `{ url: string|null, bypass: string|null }` | After `detectSystemProxy` |

### 3.3 Message Routing in SettingsMessageHandler

The existing `SettingsMessageHandler.handle()` switch statement will be extended with a delegation pattern:

```typescript
// In SettingsMessageHandler.handle()
case "getProxyState":
case "setProxyMode":
case "saveProxy":
case "saveProxyCredentials":
case "clearProxyCredentials":
case "testProxyConnection":
case "detectSystemProxy":
  await this.proxyHandler.handle(msg);
  break;
```

This keeps the single entry point but delegates proxy logic to `ProxyMessageHandler`.


---

## 4. Class Design

### 4.1 ProxyModels (`extension/src/models/ProxyModels.ts`)

```typescript
/**
 * ProxyModels — Data types for proxy configuration feature.
 * Pure interfaces/types — no logic.
 */

/** Proxy operating mode */
export type ProxyMode = "none" | "system" | "manual";

/** Persisted proxy configuration (VS Code settings) */
export interface ProxyConfig {
  mode: ProxyMode;
  host: string;
  port: number;
  bypass: string;
}

/** Proxy credentials (SecretStorage — NEVER in settings JSON) */
export interface ProxyCredentials {
  username: string;
  password: string;
}

/** Full proxy state sent to webview for rendering */
export interface ProxyState {
  mode: ProxyMode;
  host: string;
  port: number;
  bypass: string;
  hasCredentials: boolean;
  username: string;
  detectedProxyUrl: string | null;
  detectedBypass: string | null;
}

/** Result of proxy connectivity test */
export interface ProxyTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/** Input for test proxy connection (unsaved form values) */
export interface ProxyTestInput {
  mode: ProxyMode;
  host: string;
  port: number;
  username?: string;
  password?: string;
}
```


### 4.2 ProxyConfigService (`extension/src/proxy/ProxyConfigService.ts`)

**Responsibility:** CRUD operations for proxy configuration. Reads from VS Code `workspace.getConfiguration()` and SecretStorage.

```typescript
/**
 * ProxyConfigService — Proxy configuration CRUD.
 * Reads/writes proxy settings from VS Code config + SecretStorage.
 */
import * as vscode from "vscode";
import type { ProxyConfig, ProxyCredentials, ProxyState } from "../models/ProxyModels";

export class ProxyConfigService {
  private static readonly CONFIG_SECTION = "kiroSdlc";
  private static readonly SECRET_USERNAME = "kiroSdlc.proxy.username";
  private static readonly SECRET_PASSWORD = "kiroSdlc.proxy.password";

  constructor(private readonly secrets: vscode.SecretStorage) {}

  /** Read current proxy config from VS Code settings */
  getConfig(): ProxyConfig { /* ... */ }

  /** Read credentials from SecretStorage (returns null if not set) */
  async getCredentials(): Promise<ProxyCredentials | null> { /* ... */ }

  /** Build full ProxyState for webview rendering */
  async getState(detectedUrl: string | null, detectedBypass: string | null): Promise<ProxyState> { /* ... */ }

  /** Update proxy mode setting */
  async setMode(mode: ProxyMode): Promise<void> { /* ... */ }

  /** Save proxy host, port, bypass settings */
  async saveProxy(host: string, port: number, bypass: string): Promise<void> { /* ... */ }

  /** Store credentials in SecretStorage */
  async saveCredentials(username: string, password: string): Promise<void> { /* ... */ }

  /** Delete credentials from SecretStorage */
  async clearCredentials(): Promise<void> { /* ... */ }
}
```

**Design Notes:**
- All config writes use `ConfigurationTarget.Global` (proxy is machine-specific)
- `getState()` combines config + credential status + detection results into one object for the webview
- Password is NEVER included in `ProxyState` — only `hasCredentials: boolean`


### 4.3 ProxyDetectionService (`extension/src/proxy/ProxyDetectionService.ts`)

**Responsibility:** Detect system proxy from environment variables and VS Code built-in settings.

```typescript
/**
 * ProxyDetectionService — System proxy auto-detection.
 * Priority: HTTPS_PROXY > HTTP_PROXY > VS Code http.proxy
 */
import * as vscode from "vscode";

export interface DetectedProxy {
  url: string | null;
  bypass: string | null;
}

export class ProxyDetectionService {
  /**
   * Detect system proxy URL.
   * Priority order (FSD BR-11):
   *   1. HTTPS_PROXY / https_proxy env var
   *   2. HTTP_PROXY / http_proxy env var
   *   3. VS Code http.proxy setting
   * @returns Detected proxy URL or null
   */
  detect(): DetectedProxy {
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const vscodeProxy = vscode.workspace
      .getConfiguration("http").get<string>("proxy", "");

    const url = httpsProxy || httpProxy || vscodeProxy || null;

    // Detect bypass list from NO_PROXY env var
    const noProxy = process.env.NO_PROXY || process.env.no_proxy || null;

    return { url, bypass: noProxy };
  }

  /** Validate a detected proxy URL format */
  isValidProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
}
```

**Design Notes:**
- Stateless service — no caching of detection results (env vars may change)
- Detection is synchronous (reading env vars and VS Code config is instant)
- Returns `null` when no system proxy found (signals direct connection)


### 4.4 ProxyAgentFactory (`extension/src/proxy/ProxyAgentFactory.ts`)

**Responsibility:** Create, cache, and invalidate undici ProxyAgent instances. Singleton pattern ensures all consumers share the same agent. Provides the `dispatcher` for `fetch()` calls.

```typescript
/**
 * ProxyAgentFactory — Singleton factory for undici ProxyAgent.
 * Creates dispatcher based on current proxy configuration.
 * Invalidated and rebuilt on config change (BR-13: no restart needed).
 */
import { ProxyAgent, type Dispatcher } from "undici";
import type { ProxyConfig, ProxyCredentials } from "../models/ProxyModels";
import { ProxyConfigService } from "./ProxyConfigService";
import { ProxyDetectionService } from "./ProxyDetectionService";

/** Module-level singleton instance */
let instance: ProxyAgentFactory | null = null;

export class ProxyAgentFactory {
  private currentAgent: ProxyAgent | null = null;
  private configService: ProxyConfigService;
  private detectionService: ProxyDetectionService;

  private constructor(configService: ProxyConfigService, detectionService: ProxyDetectionService) {
    this.configService = configService;
    this.detectionService = detectionService;
  }

  /** Initialize singleton (called at extension activation) */
  static initialize(configService: ProxyConfigService, detectionService: ProxyDetectionService): void {
    instance = new ProxyAgentFactory(configService, detectionService);
  }

  /** Get the singleton instance */
  static getInstance(): ProxyAgentFactory {
    if (!instance) { throw new Error("ProxyAgentFactory not initialized"); }
    return instance;
  }

  /**
   * Get the current dispatcher for fetch() calls.
   * Returns ProxyAgent if proxy configured, undefined for direct connection.
   * Called by HttpClient on every request.
   */
  async getDispatcher(): Promise<Dispatcher | undefined> {
    const config = this.configService.getConfig();

    if (config.mode === "none") {
      return undefined; // Direct connection
    }

    const proxyUrl = await this.resolveProxyUrl(config);
    if (!proxyUrl) {
      return undefined; // No proxy resolved, fall back to direct
    }

    // Rebuild agent if URL changed or agent doesn't exist
    if (!this.currentAgent || this.getAgentUri() !== proxyUrl) {
      await this.rebuildAgent(proxyUrl);
    }
    return this.currentAgent ?? undefined;
  }

  /**
   * Check if a target URL should bypass the proxy.
   * Implements FSD Appendix 13.2 bypass matching algorithm.
   */
  shouldBypass(targetUrl: string, bypassList: string): boolean { /* ... */ }

  /** Invalidate cached agent (called after config save) */
  invalidate(): void {
    this.currentAgent?.close();
    this.currentAgent = null;
  }

  /** Create a temporary ProxyAgent for testing (not cached) */
  async createTemporaryAgent(proxyUrl: string, credentials?: ProxyCredentials): Promise<ProxyAgent> {
    const opts: any = { uri: proxyUrl };
    if (credentials) {
      opts.token = "Basic " + Buffer.from(
        credentials.username + ":" + credentials.password
      ).toString("base64");
    }
    return new ProxyAgent(opts);
  }

  private async resolveProxyUrl(config: ProxyConfig): Promise<string | null> { /* ... */ }
  private async rebuildAgent(proxyUrl: string): Promise<void> { /* ... */ }
  private getAgentUri(): string { /* ... */ }
}
```

**Design Notes:**
- **Singleton** — initialized at extension `activate()`; all HttpClient instances use same factory
- **Lazy rebuild** — agent only recreated when proxy URL actually changes
- **`invalidate()`** — called after `saveProxy()` or `setMode()` to force next `getDispatcher()` to rebuild
- **`createTemporaryAgent()`** — used by ProxyTestService for "test with unsaved values" (BR-09)
- **Bypass check** — called by HttpClient before using dispatcher; matching requests skip proxy


### 4.5 ProxyTestService (`extension/src/proxy/ProxyTestService.ts`)

**Responsibility:** Test proxy connectivity using current (unsaved) form values. Creates a temporary ProxyAgent, sends a test request, measures latency.

```typescript
/**
 * ProxyTestService — Proxy connectivity testing.
 * Uses temporary ProxyAgent built from unsaved form values (BR-09).
 */
import { ProxyAgent } from "undici";
import type { ProxyTestInput, ProxyTestResult, ProxyCredentials } from "../models/ProxyModels";
import { ProxyDetectionService } from "./ProxyDetectionService";

export class ProxyTestService {
  private readonly detectionService: ProxyDetectionService;

  constructor(detectionService: ProxyDetectionService) {
    this.detectionService = detectionService;
  }

  /**
   * Test proxy connectivity using form values.
   * Creates temp ProxyAgent, sends GET to https://httpbin.org/get (or configurable).
   * Timeout: 10s (BR-10).
   */
  async testConnection(input: ProxyTestInput): Promise<ProxyTestResult> {
    const proxyUrl = this.resolveTestProxyUrl(input);
    if (!proxyUrl) {
      return { success: false, message: "No proxy URL to test" };
    }

    let agent: ProxyAgent | null = null;
    try {
      const credentials: ProxyCredentials | undefined =
        input.username && input.password
          ? { username: input.username, password: input.password }
          : undefined;

      const opts: any = { uri: proxyUrl };
      if (credentials) {
        opts.token = "Basic " + Buffer.from(
          ${credentials.username}:
        ).toString("base64");
      }
      agent = new ProxyAgent(opts);

      const start = Date.now();
      const response = await fetch("https://httpbin.org/get", {
        dispatcher: agent,
        signal: AbortSignal.timeout(10_000),
      } as any);
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { success: true, message: "Proxy connection successful", latencyMs };
      }
      if (response.status === 407) {
        return { success: false, message: "Proxy requires authentication — enter credentials" };
      }
      return { success: false, message: HTTP , latencyMs };
    } catch (err: any) {
      return this.mapErrorToResult(err);
    } finally {
      agent?.close();
    }
  }

  private resolveTestProxyUrl(input: ProxyTestInput): string | null { /* ... */ }
  private mapErrorToResult(err: Error): ProxyTestResult { /* ... */ }
}
```

**Error Mapping (FSD Section 8.1):**

| Error Pattern | ProxyTestResult.message |
|---------------|------------------------|
| `err.code === "ECONNREFUSED"` | "Connection refused — verify proxy host and port" |
| `err.code === "ENOTFOUND"` | "Cannot resolve proxy hostname" |
| `err.name === "TimeoutError"` | "Connection timed out — proxy may be unreachable" |
| `err.message.includes("SSL")` or `err.code === "ERR_TLS..."` | "SSL error — proxy may require specific certificate configuration" |
| Default | `"Connection failed: " + err.message` |


### 4.6 ProxyMessageHandler (`extension/src/proxy/ProxyMessageHandler.ts`)

**Responsibility:** Handle all 7 proxy-related webview messages. Composes ProxyConfigService, ProxyDetectionService, ProxyTestService, and ProxyAgentFactory.

```typescript
/**
 * ProxyMessageHandler — Handles proxy-specific webview messages.
 * Composed by SettingsMessageHandler (delegation pattern).
 */
import * as vscode from "vscode";
import { ProxyConfigService } from "./ProxyConfigService";
import { ProxyDetectionService } from "./ProxyDetectionService";
import { ProxyTestService } from "./ProxyTestService";
import { ProxyAgentFactory } from "./ProxyAgentFactory";
import type { ProxyMode } from "../models/ProxyModels";

export class ProxyMessageHandler {
  private readonly configService: ProxyConfigService;
  private readonly detectionService: ProxyDetectionService;
  private readonly testService: ProxyTestService;

  constructor(
    secrets: vscode.SecretStorage,
    private readonly postMessage: (msg: any) => void
  ) {
    this.configService = new ProxyConfigService(secrets);
    this.detectionService = new ProxyDetectionService();
    this.testService = new ProxyTestService(this.detectionService);
  }

  async handle(msg: any): Promise<void> {
    switch (msg.type) {
      case "getProxyState":
        await this.handleGetProxyState();
        break;
      case "setProxyMode":
        await this.handleSetProxyMode(msg.mode);
        break;
      case "saveProxy":
        await this.handleSaveProxy(msg.host, msg.port, msg.bypass);
        break;
      case "saveProxyCredentials":
        await this.handleSaveProxyCredentials(msg.username, msg.password);
        break;
      case "clearProxyCredentials":
        await this.handleClearProxyCredentials();
        break;
      case "testProxyConnection":
        await this.handleTestProxyConnection(msg);
        break;
      case "detectSystemProxy":
        await this.handleDetectSystemProxy();
        break;
    }
  }

  private async handleGetProxyState(): Promise<void> {
    const detected = this.detectionService.detect();
    const state = await this.configService.getState(detected.url, detected.bypass);
    this.postMessage({ type: "proxyState", ...state });
  }

  private async handleSetProxyMode(mode: ProxyMode): Promise<void> {
    try {
      await this.configService.setMode(mode);
      ProxyAgentFactory.getInstance().invalidate();
      this.postMessage({ type: "proxyModeChanged", mode, success: true });
      // Also send updated state for UI refresh
      await this.handleGetProxyState();
    } catch (err: any) {
      this.postMessage({ type: "proxyModeChanged", mode, success: false, error: err.message });
    }
  }

  private async handleSaveProxy(host: string, port: number, bypass: string): Promise<void> {
    // Validation (BR-02, BR-03)
    if (!host || host.trim().length === 0) {
      this.postMessage({ type: "proxySaved", success: false, error: "Proxy host is required in Manual mode" });
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      this.postMessage({ type: "proxySaved", success: false, error: "Port must be a number between 1 and 65535" });
      return;
    }
    try {
      await this.configService.saveProxy(host.trim(), port, bypass);
      ProxyAgentFactory.getInstance().invalidate(); // Force rebuild on next request
      this.postMessage({ type: "proxySaved", success: true });
    } catch (err: any) {
      this.postMessage({ type: "proxySaved", success: false, error: err.message });
    }
  }

  // ... remaining handlers follow same pattern
}
```


---

## 5. HttpClient Modification

### 5.1 Strategy: Dispatcher Injection

The existing `HttpClient` uses Node.js native `fetch()` directly. To route through proxy, we inject `undici.ProxyAgent` as the `dispatcher` option. This is the **only supported way** to proxy native `fetch()` in Node.js 20+.

### 5.2 Changes to HttpClient.ts

```typescript
// BEFORE (current implementation)
const response = await fetch(url, {
  method: "GET",
  headers,
  signal: AbortSignal.timeout(timeout || 10000),
});

// AFTER (with proxy support)
import { ProxyAgentFactory } from "./ProxyAgentFactory";

const dispatcher = await this.getProxyDispatcher(url);
const response = await fetch(url, {
  method: "GET",
  headers,
  signal: AbortSignal.timeout(timeout || 10000),
  ...(dispatcher ? { dispatcher } : {}),
} as any); // Type assertion needed: Node.js fetch accepts dispatcher but @types/node doesn't declare it
```

### 5.3 New Private Method in HttpClient

```typescript
/**
 * Get proxy dispatcher for a target URL.
 * Returns undefined (direct connection) if:
 *   - Proxy mode is "none"
 *   - No proxy URL resolved
 *   - Target URL matches bypass list
 */
private async getProxyDispatcher(targetUrl: string): Promise<Dispatcher | undefined> {
  try {
    const factory = ProxyAgentFactory.getInstance();
    const config = factory.getConfig(); // Expose config reading for bypass check

    // Check bypass list before returning dispatcher
    if (factory.shouldBypass(targetUrl, config.bypass)) {
      return undefined;
    }
    return await factory.getDispatcher();
  } catch {
    // ProxyAgentFactory not initialized or error — fall back to direct
    return undefined;
  }
}
```

### 5.4 Methods to Modify

All 4 `fetch()` call sites in HttpClient need the dispatcher:

| Method | Current fetch() | Change |
|--------|----------------|--------|
| `get()` | `fetch(url, { method: "GET", headers, signal })` | Add `dispatcher` |
| `post()` | `fetch(url, { method: "POST", headers, body, signal })` | Add `dispatcher` |
| `stream()` | `fetch(url, { method: "POST", headers, body, signal })` | Add `dispatcher` |
| `healthCheck()` | `fetch(url, { method: "GET", signal })` | Add `dispatcher` |

### 5.5 Type Safety Note

Node.js `fetch()` at runtime accepts the `dispatcher` option (it's built on undici), but `@types/node` does not declare it in `RequestInit`. We use `as any` type assertion on the options object. This is an accepted pattern in the Node.js ecosystem for proxy support.

### 5.6 Graceful Degradation

If `ProxyAgentFactory` is not initialized (e.g., during extension activation race condition), `getProxyDispatcher()` catches the error and returns `undefined`, ensuring the request proceeds without proxy. This prevents proxy misconfiguration from breaking the entire extension.


---

## 6. Configuration Schema

### 6.1 VS Code `contributes.configuration` Entries

Add to `extension/package.json` under `contributes.configuration.properties`:

```json
{
  "kiroSdlc.proxy.mode": {
    "type": "string",
    "enum": ["none", "system", "manual"],
    "default": "system",
    "description": "Proxy mode: none (direct connection), system (auto-detect from environment), manual (user-configured)",
    "enumDescriptions": [
      "Direct connection — no proxy",
      "Auto-detect from environment variables and VS Code http.proxy setting",
      "Manual configuration — specify proxy host and port"
    ]
  },
  "kiroSdlc.proxy.host": {
    "type": "string",
    "default": "",
    "description": "Proxy server hostname or IP address (used when mode = manual)"
  },
  "kiroSdlc.proxy.port": {
    "type": "number",
    "default": 8080,
    "minimum": 1,
    "maximum": 65535,
    "description": "Proxy server port (used when mode = manual)"
  },
  "kiroSdlc.proxy.bypass": {
    "type": "string",
    "default": "localhost,127.0.0.1,::1",
    "description": "Comma-separated list of hosts/domains that bypass the proxy. Supports wildcards (*.domain.com)"
  }
}
```

### 6.2 SecretStorage Keys

| Key | Purpose | Access |
|-----|---------|--------|
| `kiroSdlc.proxy.username` | Proxy auth username | ProxyConfigService |
| `kiroSdlc.proxy.password` | Proxy auth password | ProxyConfigService (NEVER exposed to webview) |

### 6.3 Configuration Read Pattern

```typescript
const config = vscode.workspace.getConfiguration("kiroSdlc");
const mode = config.get<string>("proxy.mode", "system") as ProxyMode;
const host = config.get<string>("proxy.host", "");
const port = config.get<number>("proxy.port", 8080);
const bypass = config.get<string>("proxy.bypass", "localhost,127.0.0.1,::1");
```


---

## 7. Implementation Checklist

### Phase 1: Foundation (No UI)

| # | Task | File(s) | Dependencies | Acceptance |
|---|------|---------|--------------|------------|
| 1.1 | Create ProxyModels interfaces | `models/ProxyModels.ts`, `models/index.ts` | None | Types compile clean |
| 1.2 | Create ProxyDetectionService | `proxy/ProxyDetectionService.ts` | 1.1 | Unit test: reads env vars correctly |
| 1.3 | Create ProxyConfigService | `proxy/ProxyConfigService.ts` | 1.1 | Unit test: reads/writes VS Code config |
| 1.4 | Create ProxyAgentFactory | `proxy/ProxyAgentFactory.ts` | 1.2, 1.3 | Unit test: creates ProxyAgent from config |
| 1.5 | Add package.json configuration entries | `package.json` | None | Extension loads without errors |
| 1.6 | Add `undici` dependency | `package.json` | None | `npm install` succeeds |

### Phase 2: HttpClient Integration

| # | Task | File(s) | Dependencies | Acceptance |
|---|------|---------|--------------|------------|
| 2.1 | Add `getProxyDispatcher()` to HttpClient | `proxy/HttpClient.ts` | 1.4 | Method exists, returns dispatcher |
| 2.2 | Inject dispatcher into `get()` | `proxy/HttpClient.ts` | 2.1 | GET requests route through proxy |
| 2.3 | Inject dispatcher into `post()` | `proxy/HttpClient.ts` | 2.1 | POST requests route through proxy |
| 2.4 | Inject dispatcher into `stream()` | `proxy/HttpClient.ts` | 2.1 | Streaming requests route through proxy |
| 2.5 | Inject dispatcher into `healthCheck()` | `proxy/HttpClient.ts` | 2.1 | Health checks route through proxy |
| 2.6 | Initialize ProxyAgentFactory at activation | `extension.ts` | 1.4, 1.3, 1.2 | Factory available after activate() |

### Phase 3: Message Handler

| # | Task | File(s) | Dependencies | Acceptance |
|---|------|---------|--------------|------------|
| 3.1 | Create ProxyTestService | `proxy/ProxyTestService.ts` | 1.2 | Connectivity test works |
| 3.2 | Create ProxyMessageHandler | `proxy/ProxyMessageHandler.ts` | 1.3, 1.2, 3.1, 1.4 | All 7 message types handled |
| 3.3 | Wire ProxyMessageHandler into SettingsMessageHandler | `panels/settings/SettingsMessageHandler.ts` | 3.2 | Proxy messages delegated correctly |

### Phase 4: Webview UI

| # | Task | File(s) | Dependencies | Acceptance |
|---|------|---------|--------------|------------|
| 4.1 | Add proxy tab HTML to SettingsPanel | `panels/settings/SettingsPanel.ts` | None | Tab renders, sections visible |
| 4.2 | Add proxy CSS styles | `webview-assets/settings/settings.css` | None | Styles applied correctly |
| 4.3 | Create proxy-tab.js webview logic | `webview-assets/settings/proxy-tab.js` | 4.1 | Form bindings work, messages sent |
| 4.4 | Add proxy-tab.js script tag to SettingsPanel HTML | `panels/settings/SettingsPanel.ts` | 4.3 | Script loads in webview |

### Phase 5: Integration & Polish

| # | Task | File(s) | Dependencies | Acceptance |
|---|------|---------|--------------|------------|
| 5.1 | End-to-end test: manual proxy mode | All proxy files | 2.x, 3.x, 4.x | Requests route through proxy |
| 5.2 | End-to-end test: system proxy detection | All proxy files | 2.x, 3.x, 4.x | Env vars detected and used |
| 5.3 | End-to-end test: bypass list | All proxy files | 2.x | Bypass hosts skip proxy |
| 5.4 | Test connection with unsaved values | ProxyTestService | 3.1 | Test uses form values, not saved config |
| 5.5 | Credential security verification | ProxyConfigService | 1.3 | Password never in logs or settings JSON |


---

## 8. Error Handling

### 8.1 Error Flow Architecture

```
Webview (proxy-tab.js)        ProxyMessageHandler              Services
     |                              |                              |
     |--- testProxyConnection ----->|                              |
     |                              |--- testService.test() ------>|
     |                              |                              |
     |                              |     [Error thrown]           |
     |                              |<---- ProxyTestResult --------|
     |                              |                              |
     |<-- proxyTestResult ---------|                              |
     |    { success: false,         |                              |
     |      message: "user-friendly"|                              |
     |    }                         |                              |
```

### 8.2 Error Handling Strategy by Layer

| Layer | Strategy | Example |
|-------|----------|---------|
| **ProxyMessageHandler** | Wrap all handler methods in try/catch; post error message back to webview; never throw unhandled | `catch (err) { this.postMessage({ type: "proxySaved", success: false, error: err.message }); }` |
| **ProxyTestService** | Map low-level errors to user-friendly messages; always return ProxyTestResult (never throw) | `ECONNREFUSED` -> "Connection refused — verify proxy host and port" |
| **ProxyAgentFactory** | On creation failure -> return `undefined` (fall back to direct); log warning | `console.warn("[Proxy] Agent creation failed: " + err.message)` |
| **HttpClient** | If dispatcher unavailable -> proceed without proxy; if 407 at runtime -> log warning | Graceful degradation to direct connection |
| **Webview (proxy-tab.js)** | Display inline errors for validation; show status-indicator for async results | Red text for validation, colored div for test results |

### 8.3 Error Code Mapping (from FSD Section 8.1)

```typescript
/**
 * Map low-level errors to user-friendly messages.
 * Used by ProxyTestService and runtime error handling.
 */
function mapProxyError(err: Error): string {
  if (err.name === "TimeoutError" || err.message.includes("timeout")) {
    return "Connection timed out — proxy may be unreachable"; // PROXY_ERR_004
  }
  if ((err as any).code === "ECONNREFUSED") {
    return "Connection refused — verify proxy host and port"; // PROXY_ERR_005
  }
  if ((err as any).code === "ENOTFOUND") {
    return "Cannot resolve proxy hostname"; // PROXY_ERR_006
  }
  if (err.message.includes("SSL") || err.message.includes("TLS") ||
      (err as any).code?.startsWith("ERR_TLS")) {
    return "SSL error — proxy may require specific certificate configuration"; // PROXY_ERR_007
  }
  return Connection failed: ; // PROXY_ERR_013
}
```

### 8.4 Validation Errors (Client-Side + Server-Side)

| Condition | Error Message | Where Validated |
|-----------|--------------|-----------------|
| Empty host, mode=manual | "Proxy host is required in Manual mode" | ProxyMessageHandler + proxy-tab.js |
| Port < 1 or > 65535 or non-integer | "Port must be a number between 1 and 65535" | ProxyMessageHandler + proxy-tab.js |
| Username without password (or vice versa) | "Both username and password are required" | ProxyMessageHandler |
| VS Code config write failure | "Failed to save proxy settings" | ProxyMessageHandler catch block |
| SecretStorage write failure | "Failed to save credentials" | ProxyMessageHandler catch block |


---

## 9. Security Design

### 9.1 Credential Protection

| Threat | Control | Implementation |
|--------|---------|----------------|
| Credentials in settings JSON | SecretStorage only | ProxyConfigService uses `vscode.SecretStorage` for username/password; NEVER writes to `workspace.getConfiguration()` |
| Credentials exposed in webview | Never send password | `ProxyState.hasCredentials: boolean` flag only; username sent for display; password NEVER transmitted to webview |
| Credentials in logs | Log masking | All proxy logging replaces password with `***`; proxy URL logged without embedded credentials |
| Credentials in error messages | Sanitized errors | Error messages reference "credentials" generically; never include actual values |
| Credentials in memory | Agent lifetime | ProxyAgent stores auth token in memory only while agent lives; `invalidate()` closes agent |

### 9.2 Log Masking Rules

```typescript
/**
 * Sanitize proxy URL for logging — remove embedded credentials.
 * Input: "http://user:pass@proxy.com:8080"
 * Output: "http://***:***@proxy.com:8080"
 */
function sanitizeProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:\/\/[^@]+@/, "://***:***@");
  }
}
```

### 9.3 Webview CSP (Content Security Policy)

The existing CSP in SettingsPanel prevents webview from making network requests:

```
default-src 'none'; script-src 'nonce-'; style-src  'unsafe-inline';
img-src  data:; font-src ; connect-src 'none';
```

**`connect-src 'none'`** ensures credentials entered in the proxy form CANNOT be exfiltrated from the webview. All network operations (test, save) happen in the extension host process only.

### 9.4 Proxy-Authorization Header Construction

```typescript
// Built ONLY in extension host process (ProxyAgentFactory)
// Uses undici ProxyAgent's built-in auth mechanism
const agent = new ProxyAgent({
  uri: proxyUrl,
  token: "Basic " + Buffer.from(${username}:).toString("base64"),
});
```

The `Proxy-Authorization` header is injected by undici internally — it never passes through user-land code after agent creation.

### 9.5 Attack Surface Analysis

| Vector | Risk | Mitigation |
|--------|------|------------|
| Malicious proxy URL injection via config | Low | URL parsed via `new URL()` — invalid URLs rejected; only http/https schemes accepted |
| MITM between extension and proxy | Medium | Extension respects Node.js TLS settings; corporate CA typically trusted at OS level |
| Credential brute-force on proxy | Low (not our concern) | Extension limits retries; 407 reported to user; no auto-retry with different creds |
| Webview XSS to steal credentials | None | Password never sent to webview; CSP `connect-src 'none'` blocks exfiltration |


---

## 10. Webview UI Implementation

### 10.1 SettingsPanel HTML Addition

Add proxy tab button to existing tab bar and proxy pane content:

```html
<!-- Tab bar: add after existing Server Settings tab button -->
<button class="tab-btn" id="tab-proxy" data-tab="pane-proxy" role="tab" aria-selected="false">
  &#128279; Proxy
</button>

<!-- Proxy pane: add after pane-server -->
<div class="tab-pane" id="pane-proxy" role="tabpanel">
  <!-- Section 1: Proxy Mode -->
  <section class="card" id="proxy-mode-section">
    <h2>&#128279; Proxy Configuration</h2>
    <p class="card-desc">Configure network proxy for outbound connections.</p>
    <div class="radio-group" id="proxy-mode-group">
      <label><input type="radio" name="proxy-mode" id="proxy-mode-none" value="none"> None (Direct)</label>
      <label><input type="radio" name="proxy-mode" id="proxy-mode-system" value="system" checked> System (Auto-detect)</label>
      <label><input type="radio" name="proxy-mode" id="proxy-mode-manual" value="manual"> Manual</label>
    </div>
    <div id="system-proxy-info" class="status-indicator" style="display:none;"></div>
  </section>

  <!-- Section 2: Manual Proxy Config -->
  <section class="card" id="proxy-manual-section">
    <h2>&#9881; Server</h2>
    <div class="form-group">
      <label for="proxy-host-input">Proxy Host</label>
      <input type="text" id="proxy-host-input" placeholder="proxy.company.com">
    </div>
    <div class="form-group">
      <label for="proxy-port-input">Proxy Port</label>
      <input type="number" id="proxy-port-input" placeholder="8080" min="1" max="65535">
    </div>
    <div id="proxy-url-preview" class="proxy-url-preview"></div>
    <div class="form-group">
      <label for="proxy-bypass-input">Bypass List</label>
      <textarea id="proxy-bypass-input" rows="2"
        placeholder="localhost,127.0.0.1,*.internal.com"></textarea>
      <small>Comma-separated. Supports wildcards: *.domain.com</small>
    </div>
  </section>

  <!-- Section 3: Authentication -->
  <section class="card" id="proxy-auth-section">
    <h2>&#128273; Authentication</h2>
    <div class="form-group">
      <label for="proxy-username-input">Username</label>
      <input type="text" id="proxy-username-input" placeholder="username">
    </div>
    <div class="form-group">
      <label for="proxy-password-input">Password</label>
      <div class="input-with-toggle">
        <input type="password" id="proxy-password-input" placeholder="Enter proxy password..." autocomplete="off">
        <button class="icon-btn" id="toggle-proxy-password" title="Show/Hide"
          aria-label="Toggle proxy password visibility">&#128065;</button>
      </div>
    </div>
    <div id="proxy-credential-status" class="status-indicator"></div>
    <div class="btn-row">
      <button id="save-proxy-credentials-btn" class="btn primary">Save Credentials</button>
      <button id="clear-proxy-credentials-btn" class="btn danger-outline">Clear Credentials</button>
    </div>
  </section>

  <!-- Section 4: Actions -->
  <section class="card" id="proxy-actions-section">
    <div class="btn-row">
      <button id="test-proxy-btn" class="btn secondary">Test Connection</button>
      <button id="save-proxy-btn" class="btn primary">Save Proxy</button>
    </div>
    <div id="proxy-test-result" class="status-indicator"></div>
  </section>
</div>
```

### 10.2 proxy-tab.js Architecture

The webview script follows the same pattern as existing `settings.js`:

```javascript
/**
 * proxy-tab.js — Webview logic for Proxy Configuration tab.
 * Handles form state, validation, postMessage communication.
 */
(function() {
  "use strict";
  const vscode = acquireVsCodeApi();

  // DOM element references
  // Mode radios, input fields, buttons, status indicators...

  // Event: Mode radio change
  function onModeChange(mode) {
    vscode.postMessage({ type: "setProxyMode", mode });
    updateFieldStates(mode);
  }

  // Event: Save Proxy button
  function onSaveProxy() {
    const host = hostInput.value.trim();
    const port = parseInt(portInput.value, 10);
    const bypass = bypassInput.value.trim();
    // Client-side validation first
    if (!validateProxyFields(host, port)) return;
    vscode.postMessage({ type: "saveProxy", host, port, bypass });
  }

  // Event: Test Connection button
  function onTestConnection() {
    const mode = getSelectedMode();
    vscode.postMessage({
      type: "testProxyConnection",
      mode,
      host: hostInput.value.trim(),
      port: parseInt(portInput.value, 10),
      username: usernameInput.value,
      password: passwordInput.value,
    });
    showTestLoading();
  }

  // Message handler: receive state and results from extension
  window.addEventListener("message", function(event) {
    const msg = event.data;
    switch (msg.type) {
      case "proxyState": renderState(msg); break;
      case "proxyModeChanged": /* update radio */ break;
      case "proxySaved": showSaveResult(msg); break;
      case "proxyCredentialsSaved": showCredentialStatus(msg); break;
      case "proxyTestResult": showTestResult(msg); break;
      case "systemProxyDetected": showSystemProxy(msg); break;
    }
  });

  // On tab activation, request current state
  function initProxyTab() {
    vscode.postMessage({ type: "getProxyState" });
  }
})();
```


---

## 11. Extension Activation & Initialization

### 11.1 Initialization Sequence

At extension `activate()`, the proxy subsystem must be initialized before any HttpClient usage:

```typescript
// In extension.ts activate() function
import { ProxyConfigService } from "./proxy/ProxyConfigService";
import { ProxyDetectionService } from "./proxy/ProxyDetectionService";
import { ProxyAgentFactory } from "./proxy/ProxyAgentFactory";

export async function activate(context: vscode.ExtensionContext) {
  // ... existing activation code ...

  // Initialize proxy subsystem (before HttpClient usage)
  const proxyConfigService = new ProxyConfigService(context.secrets);
  const proxyDetectionService = new ProxyDetectionService();
  ProxyAgentFactory.initialize(proxyConfigService, proxyDetectionService);

  // ... rest of activation (HttpClient, MCP server, etc.) ...
}
```

### 11.2 Configuration Change Listener

Listen for proxy setting changes to invalidate the agent immediately (BR-13):

```typescript
// Register config change listener
context.subscriptions.push(
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("kiroSdlc.proxy")) {
      ProxyAgentFactory.getInstance().invalidate();
    }
  })
);
```


---

## 12. Dependency Management

### 12.1 New npm Dependency

```json
{
  "dependencies": {
    "undici": "^6.21.0"
  }
}
```

**Why undici:**
- Node.js 20+ `fetch()` is built on undici internally
- `ProxyAgent` is the official undici class for HTTP proxy support
- Already bundled with Node.js runtime (but importing explicitly ensures version control)
- Provides typed `Dispatcher` interface for `fetch()` dispatcher option

### 12.2 No Other New Dependencies

The feature uses only:
- `undici` (ProxyAgent, Dispatcher types)
- VS Code Extension API (already available)
- Node.js built-in `process.env`, `Buffer`, `URL`

---

## 13. Bypass List Matching Algorithm

### 13.1 Implementation (from FSD Appendix 13.2)

```typescript
/**
 * Check if a target URL should bypass the proxy.
 * Supports exact hostname match and wildcard suffix match (*.domain.com).
 */
export function shouldBypass(targetUrl: string, bypassList: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    return false; // Invalid URL, don't bypass
  }

  const entries = bypassList.split(",").map(e => e.trim()).filter(Boolean);
  for (const entry of entries) {
    if (entry.startsWith("*.")) {
      // Wildcard match: *.domain.com matches sub.domain.com and domain.com
      const suffix = entry.slice(1); // ".domain.com"
      if (hostname.endsWith(suffix) || hostname === entry.slice(2)) {
        return true;
      }
    } else {
      // Exact match
      if (hostname === entry) {
        return true;
      }
    }
  }
  return false;
}
```

### 13.2 Bypass Merge Strategy (System Mode)

When mode = "system", bypass list is merged from multiple sources:
1. `NO_PROXY` / `no_proxy` environment variable
2. User-configured `kiroSdlc.proxy.bypass` setting
3. Default entries: `localhost,127.0.0.1,::1`

Merge = union of all entries (deduplicated).


---

## 14. Testing Strategy

### 14.1 Unit Tests

| # | Test File | Tests | Focus |
|---|-----------|-------|-------|
| 1 | `ProxyDetectionService.test.ts` | 6 tests | Env var priority, case-insensitive, VS Code fallback, no proxy found |
| 2 | `ProxyConfigService.test.ts` | 8 tests | Read/write config, credential CRUD, state building |
| 3 | `ProxyAgentFactory.test.ts` | 10 tests | Agent creation, caching, invalidation, bypass matching, mode handling |
| 4 | `ProxyTestService.test.ts` | 8 tests | Success case, timeout, refused, DNS, 407, error mapping |
| 5 | `ProxyMessageHandler.test.ts` | 7 tests | Each message type handled, validation errors |
| 6 | `shouldBypass.test.ts` | 10 tests | Exact match, wildcard, edge cases, empty list |

### 14.2 Integration Tests

| # | Scenario | Setup |
|---|----------|-------|
| 1 | HttpClient GET through proxy | Mock proxy server (local); verify request arrives via proxy |
| 2 | HttpClient POST with auth | Mock proxy requiring 407 -> retry with auth header |
| 3 | Bypass list skips proxy | Request to bypass host -> verify no proxy contact |
| 4 | Mode change applies immediately | Change mode -> next request uses new mode |
| 5 | Config persistence across reload | Save config -> read back -> values match |

### 14.3 Manual Test Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Fresh install | Open Settings -> Proxy tab | Mode = System, fields match defaults |
| 2 | Configure manual proxy | Enter host:port -> Save -> Test | Save succeeds, test shows latency |
| 3 | System proxy detection | Set HTTP_PROXY env -> Open tab | Detected URL displayed |
| 4 | Credential flow | Enter user/pass -> Save -> Clear | Status indicators update correctly |
| 5 | Mode switching | Switch None -> System -> Manual | Fields enable/disable correctly |

---

## 15. Non-Functional Considerations

### 15.1 Performance

| Concern | Design Decision |
|---------|-----------------|
| ProxyAgent creation overhead | Agent is cached; only rebuilt on config change (not per-request) |
| Bypass list matching | O(n) scan on comma-split list; n is typically < 10 entries; negligible |
| System proxy detection | Synchronous env var read; < 1ms |
| Proxy tab initialization | Single `getProxyState` message; all data in one response; < 100ms |

### 15.2 Memory

| Item | Estimated Memory |
|------|-----------------|
| ProxyAgent instance | ~2KB (single connection pool reference) |
| ProxyConfigService | ~1KB (no state caching) |
| Total proxy subsystem | < 10KB additional memory |

### 15.3 Startup Impact

ProxyAgentFactory initialization is synchronous (just constructor assignment). The actual ProxyAgent is created lazily on first HTTP request. Extension activation time impact: **< 1ms**.


---

## 16. Traceability Matrix

### Requirements -> Design Mapping

| BRD Story | FSD Use Case | Business Rule | Design Component | Implementation File |
|-----------|-------------|---------------|-----------------|---------------------|
| Story 1 | UC-01 | BR-02, BR-03, BR-16 | ProxyConfigService.saveProxy() | `proxy/ProxyConfigService.ts` |
| Story 2 | UC-02 | BR-01, BR-13 | ProxyConfigService.setMode() + ProxyAgentFactory.invalidate() | `proxy/ProxyConfigService.ts`, `proxy/ProxyAgentFactory.ts` |
| Story 3 | UC-03 | BR-04, BR-05, BR-06, BR-17 | ProxyConfigService.saveCredentials() + ProxyAgent auth token | `proxy/ProxyConfigService.ts`, `proxy/ProxyAgentFactory.ts` |
| Story 4 | UC-04 | BR-07, BR-08, BR-18 | shouldBypass() + ProxyConfigService.saveProxy(bypass) | `proxy/ProxyAgentFactory.ts` |
| Story 5 | UC-05 | BR-09, BR-10 | ProxyTestService.testConnection() | `proxy/ProxyTestService.ts` |
| Story 6 | UC-06 | BR-11, BR-12 | ProxyDetectionService.detect() | `proxy/ProxyDetectionService.ts` |

### Business Rules Coverage

| Rule | Implemented By |
|------|---------------|
| BR-01: Default mode = "system" | `package.json` config default |
| BR-02: Port 1-65535 | ProxyMessageHandler validation |
| BR-03: Host non-empty for manual | ProxyMessageHandler validation |
| BR-04: Both user+pass or neither | ProxyMessageHandler validation |
| BR-05: Credentials in SecretStorage | ProxyConfigService (never workspace config) |
| BR-06: No credentials in logs | sanitizeProxyUrl() utility |
| BR-07: Default bypass list | `package.json` config default |
| BR-08: Wildcard bypass | shouldBypass() algorithm |
| BR-09: Test uses form values | ProxyTestService creates temp agent from input |
| BR-10: 10s test timeout | AbortSignal.timeout(10_000) in ProxyTestService |
| BR-11: Detection priority | ProxyDetectionService.detect() order |
| BR-12: Case-insensitive env vars | `process.env.HTTPS_PROXY || process.env.https_proxy` |
| BR-13: Immediate apply | ProxyAgentFactory.invalidate() on save |
| BR-14: All requests respect proxy | HttpClient.getProxyDispatcher() on every fetch |
| BR-15: Persist across sessions | VS Code Global configuration + SecretStorage |
| BR-16: URL format | Composed in ProxyAgentFactory.resolveProxyUrl() |
| BR-17: Proxy-Authorization header | undici ProxyAgent `token` option |
| BR-18: Bypass matching | shouldBypass() exact + wildcard suffix |


---

## 17. Open Technical Decisions

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| 1 | Test endpoint URL | httpbin.org vs configurable vs backend /health | Use backend `/health` endpoint (already known to work); fall back to `https://httpbin.org/get` if backend not configured | Decided |
| 2 | undici version | Bundled with Node.js vs explicit dependency | Explicit `undici ^6.21.0` in package.json for type safety and version control | Decided |
| 3 | Proxy for LLM direct calls | Route Ollama/LM Studio (localhost) through proxy? | No — localhost in default bypass list; user can remove if needed | Decided |
| 4 | HTTPS proxy URL support | Support `https://` proxy scheme | Yes — ProxyAgent supports both http and https URIs; pass through as-is | Decided |
| 5 | Config scope | Global vs Workspace | Global — proxy is machine-specific, not project-specific | Decided |

---

## 18. Glossary

| Term | Definition |
|------|------------|
| Dispatcher | undici concept — an object that handles sending HTTP requests; ProxyAgent implements Dispatcher |
| ProxyAgent | undici class that routes HTTP requests through an HTTP/HTTPS proxy server |
| SecretStorage | VS Code encrypted per-extension storage for sensitive data (credentials) |
| Bypass List | Comma-separated hostnames/patterns that skip proxy and connect directly |
| System Proxy | Proxy configuration inherited from OS environment variables or VS Code settings |
| postMessage | VS Code webview communication protocol between extension host and webview JavaScript |

---

*End of TDD — SA4E-PROXY v1.0*

