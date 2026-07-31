# Functional Specification Document (FSD)

## SDLC Agents 4 Enterprise — SA4E-PROXY: Proxy Configuration Page

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-PROXY |
| Title | Proxy Configuration Page — Enterprise network proxy settings UI |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related BRD | documents/SA4E-PROXY/BRD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document — FSD created from BRD (6 User Stories) |

---

## 1. Introduction

### 1.1 Purpose

This FSD translates the SA4E-PROXY BRD into detailed functional specifications for the Proxy Configuration Page feature. It defines use cases, business rules, data models, API contracts (postMessage protocol), UI specifications, error handling, and state management.

### 1.2 Scope

- Add "Proxy" tab (3rd tab) to existing Settings Panel webview
- Proxy mode selection: None / System / Manual
- Manual proxy configuration (host, port, auth, bypass list)
- System proxy auto-detection (env vars + VS Code settings)
- Proxy connectivity testing
- Integration with HttpClient for all outbound requests
- Secure credential storage via VS Code SecretStorage

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| ProxyAgent | Node.js undici agent that routes HTTP/HTTPS through a proxy server |
| Bypass List | Comma-separated hosts/domains that skip proxy (direct connection) |
| System Proxy | Proxy detected from environment variables or VS Code settings |
| postMessage | VS Code webview ↔ extension host communication protocol |
| SecretStorage | VS Code encrypted per-extension secret storage API |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-PROXY/BRD.md |
| SettingsPanel.ts | extension/src/panels/settings/SettingsPanel.ts |
| SettingsMessageHandler.ts | extension/src/panels/settings/SettingsMessageHandler.ts |
| HttpClient.ts | extension/src/proxy/HttpClient.ts |
| VS Code SecretStorage API | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| Node.js undici ProxyAgent | https://undici.nodejs.org/#/docs/api/ProxyAgent |

---

## 2. System Overview

### 2.1 System Context

The Proxy Configuration Page operates within the VS Code extension host environment:

- **Webview (HTML/CSS/JS):** Renders the Proxy tab UI, captures user input, sends messages via `postMessage`
- **Extension Host (TypeScript):** Receives messages via `SettingsMessageHandler`, manages configuration persistence, performs proxy testing, provides ProxyAgent to HttpClient
- **VS Code APIs:** `workspace.getConfiguration()` for settings, `SecretStorage` for credentials
- **External:** Corporate proxy server (target of outbound requests)

### 2.2 Integration Points

| Component | Role | Communication |
|-----------|------|---------------|
| Webview (pane-proxy) | UI rendering, user input | postMessage ↔ extension host |
| SettingsMessageHandler | Message routing, business logic | Internal method calls |
| ProxyConfigService | Proxy settings CRUD | VS Code Configuration API |
| ProxyCredentialService | Username/password CRUD | VS Code SecretStorage |
| ProxyDetectionService | System proxy detection | Environment variables, VS Code config |
| HttpClient | Outbound HTTP with proxy | undici ProxyAgent injection |

---

## 3. Use Cases

### 3.1 UC-01: Configure Proxy Host and Port

**Source:** BRD Story 1
**Actor:** Developer
**Preconditions:** Settings Panel is open, Proxy tab is active, Proxy Mode = "Manual"
**Postconditions:** Proxy host and port saved to workspace settings; HttpClient uses new proxy

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Enters proxy host | | User types hostname/IP in host field |
| 2 | Enters proxy port | | User types port number (1-65535) |
| 3 | | Validates input | System validates host format and port range |
| 4 | | Shows URL preview | Displays composed `http://{host}:{port}` |
| 5 | Clicks "Save Proxy" | | User triggers save action |
| 6 | | Persists settings | Saves to `kiroSdlc.proxy.host` and `kiroSdlc.proxy.port` |
| 7 | | Confirms save | Posts `proxySaved` message with success=true |
| 8 | | Applies to HttpClient | ProxyAgent updated for subsequent requests |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01-1 | User changes host while port already filled | System updates URL preview immediately on input change |
| AF-01-2 | User leaves host empty but fills port | Save button remains enabled; validation error shown on save attempt |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01-1 | Invalid port (non-numeric or out of range) | System shows inline error "Port must be a number between 1 and 65535"; save blocked |
| EF-01-2 | Empty host on save | System shows inline error "Proxy host is required in Manual mode"; save blocked |
| EF-01-3 | VS Code config API failure | System posts `proxySaved` with success=false, error message displayed |

---

### 3.2 UC-02: Select Proxy Mode

**Source:** BRD Story 2
**Actor:** Developer
**Preconditions:** Settings Panel is open, Proxy tab is active
**Postconditions:** Proxy mode saved; UI fields updated; HttpClient behavior changed accordingly

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Selects proxy mode | | User clicks radio button (None/System/Manual) |
| 2 | | Updates UI state | Enable/disable fields based on selected mode |
| 3 | | Persists mode | Saves to `kiroSdlc.proxy.mode` |
| 4 | | Applies mode | HttpClient updated: none=direct, system=detected proxy, manual=configured proxy |
| 5 | | Posts confirmation | Sends `proxyModeChanged` with new mode |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-02-1 | Mode = "None" selected | All proxy fields disabled; direct connection used |
| AF-02-2 | Mode = "System" selected | Manual fields disabled; system proxy detection triggered; detected URL shown read-only |
| AF-02-3 | Mode = "Manual" selected | All manual proxy fields enabled for user input |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-02-1 | System mode but no proxy detected | Show info label "No system proxy detected — using direct connection" |
| EF-02-2 | Config API write failure | Show error toast; revert radio to previous state |

---

### 3.3 UC-03: Configure Proxy Authentication

**Source:** BRD Story 3
**Actor:** Developer
**Preconditions:** Settings Panel open, Proxy tab active, Mode = "Manual"
**Postconditions:** Credentials stored in SecretStorage; Proxy-Authorization header injected on requests

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Enters username | | User types proxy username |
| 2 | Enters password | | User types proxy password (masked) |
| 3 | Clicks "Save Credentials" | | User triggers credential save |
| 4 | | Validates pair | Checks both username AND password are provided |
| 5 | | Stores in SecretStorage | Saves `kiroSdlc.proxy.username` and `kiroSdlc.proxy.password` |
| 6 | | Shows status | Displays "✅ Credentials saved" indicator |
| 7 | | Updates ProxyAgent | Adds Basic auth to proxy URL for subsequent requests |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03-1 | User toggles password visibility | Password field switches between type=password and type=text |
| AF-03-2 | User clicks "Clear Credentials" | Both username and password deleted from SecretStorage; fields cleared; status updated |
| AF-03-3 | Credentials already saved (re-open tab) | Username field shows saved value; password shows "••••••" placeholder; status shows "✅ Credentials saved" |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-03-1 | Only username provided (no password) | Show error "Both username and password are required" |
| EF-03-2 | Only password provided (no username) | Show error "Both username and password are required" |
| EF-03-3 | SecretStorage write failure | Show error "Failed to save credentials"; status shows "⚠️ Not saved" |
| EF-03-4 | Proxy returns 407 at runtime | HttpClient catches 407, notifies user "Proxy authentication failed — check credentials" |

---

### 3.4 UC-04: Configure Bypass List

**Source:** BRD Story 4
**Actor:** Developer
**Preconditions:** Settings Panel open, Proxy tab active, Mode = "Manual" or "System"
**Postconditions:** Bypass list saved; matching requests skip proxy

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Enters bypass list | | User types comma-separated hosts in textarea |
| 2 | | Trims entries | System trims whitespace from each entry |
| 3 | Clicks "Save Proxy" | | User triggers save action |
| 4 | | Persists bypass | Saves to `kiroSdlc.proxy.bypass` |
| 5 | | Applies to routing | Requests to bypass hosts skip ProxyAgent |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-04-1 | Bypass list is empty | All traffic routes through proxy (no bypass) |
| AF-04-2 | User uses wildcard `*.domain.com` | Wildcard pattern stored; matching applied at request time |
| AF-04-3 | First time open (no saved bypass) | Default values pre-filled: `localhost,127.0.0.1,::1` |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-04-1 | Config API write failure | Show error toast; bypass list not saved |

---

### 3.5 UC-05: Test Proxy Connectivity

**Source:** BRD Story 5
**Actor:** Developer
**Preconditions:** Settings Panel open, Proxy tab active, proxy configuration entered (not necessarily saved)
**Postconditions:** Connectivity result displayed (success with latency, or failure with error)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Clicks "Test Connection" | | User triggers connectivity test |
| 2 | | Shows loading state | Button disabled, spinner shown |
| 3 | | Builds test config | Uses CURRENT form values (unsaved) to create temporary ProxyAgent |
| 4 | | Sends test request | HTTP GET to test endpoint via proxy, 10s timeout |
| 5 | | Measures latency | Records time from request start to response |
| 6 | | Displays result | Shows "✅ Proxy connection successful (latency: Xms)" |
| 7 | | Restores button | Button re-enabled, spinner hidden |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-05-1 | Mode = "System" and system proxy detected | Test uses detected system proxy URL |
| AF-05-2 | Mode = "None" | Test button disabled or tests direct connection |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-05-1 | Timeout (10s) | Show "❌ Connection timed out — proxy may be unreachable" |
| EF-05-2 | Connection refused | Show "❌ Connection refused — verify proxy host and port" |
| EF-05-3 | DNS resolution failed | Show "❌ Cannot resolve proxy hostname" |
| EF-05-4 | SSL/TLS error | Show "❌ SSL error — proxy may require specific certificate configuration" |
| EF-05-5 | 407 response | Show "❌ Proxy requires authentication — enter credentials" |
| EF-05-6 | Unknown error | Show "❌ Connection failed: {error.message}" |

---

### 3.6 UC-06: Auto-detect System Proxy

**Source:** BRD Story 6
**Actor:** System (automatic) / Developer (triggers refresh)
**Preconditions:** Proxy Mode = "System"
**Postconditions:** Detected proxy URL displayed; HttpClient uses detected proxy

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Selects "System" mode | | User picks System radio or opens tab with System as saved mode |
| 2 | | Reads env vars | Checks HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy |
| 3 | | Reads VS Code setting | Checks `http.proxy` VS Code built-in setting |
| 4 | | Reads NO_PROXY | Checks NO_PROXY, no_proxy for bypass list |
| 5 | | Resolves priority | Priority: env var HTTPS_PROXY > HTTP_PROXY > VS Code http.proxy |
| 6 | | Displays detected URL | Shows proxy URL in read-only label (monospace) |
| 7 | | Shows detection status | "✅ System proxy detected" or "ℹ️ No system proxy detected" |
| 8 | | Applies to HttpClient | ProxyAgent configured with detected URL |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-06-1 | Only HTTP_PROXY set (no HTTPS_PROXY) | Use HTTP_PROXY for all requests |
| AF-06-2 | VS Code http.proxy set but no env vars | Use VS Code setting |
| AF-06-3 | Both env var and VS Code setting exist | Env var takes priority |
| AF-06-4 | NO_PROXY env var contains bypass entries | Merge with default bypass list |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-06-1 | No system proxy found anywhere | Display "No system proxy detected — using direct connection"; HttpClient uses no proxy |
| EF-06-2 | Detected URL is malformed | Display warning "System proxy URL appears invalid: {url}"; allow user to switch to Manual |

---

## 4. Business Rules

| Rule ID | Rule | Source | Applies To |
|---------|------|--------|------------|
| BR-01 | Default proxy mode is "System" for new installations | BRD Story 2 | UC-02 |
| BR-02 | Port must be integer in range 1-65535 | BRD Story 1 | UC-01 |
| BR-03 | Proxy host must be non-empty valid hostname or IPv4/IPv6 when mode = Manual | BRD Story 1 | UC-01 |
| BR-04 | Username and password must both be provided or both be empty (no partial credentials) | BRD Story 3 | UC-03 |
| BR-05 | Credentials MUST be stored in SecretStorage, NEVER in workspace settings JSON | BRD Story 3 | UC-03 |
| BR-06 | Credentials MUST NOT be logged or exposed in error messages | BRD Story 3, NFR | UC-03 |
| BR-07 | Default bypass list includes: `localhost,127.0.0.1,::1` | BRD Story 4 | UC-04 |
| BR-08 | Bypass list supports wildcard patterns (`*.domain.com`) | BRD Story 4 | UC-04 |
| BR-09 | Test Connection uses current form values (unsaved state), not persisted settings | BRD Story 5 | UC-05 |
| BR-10 | Test Connection timeout is 10 seconds | BRD Story 5 | UC-05 |
| BR-11 | System proxy detection priority: HTTPS_PROXY > HTTP_PROXY > VS Code http.proxy | BRD Story 6 | UC-06 |
| BR-12 | Environment variables are case-insensitive (HTTP_PROXY = http_proxy) | BRD Story 6 | UC-06 |
| BR-13 | Mode change applies immediately to subsequent requests (no extension restart needed) | BRD Story 2 | UC-02 |
| BR-14 | All outbound requests from extension MUST respect proxy configuration | BRD Story 1 | All |
| BR-15 | Proxy settings persist across VS Code sessions (workspace-level settings) | BRD Story 1 | All |
| BR-16 | Proxy URL format: `http://{host}:{port}` (or `https://{host}:{port}` if HTTPS proxy) | BRD Story 1 | UC-01 |
| BR-17 | When proxy auth credentials exist, inject Proxy-Authorization header (Basic scheme) | BRD Story 3 | UC-03 |
| BR-18 | Bypass matching: exact hostname match OR wildcard suffix match | BRD Story 4 | UC-04 |

---

## 5. Data Model

### 5.1 Interfaces / Types

#### ProxyMode (Enum)

```typescript
type ProxyMode = "none" | "system" | "manual";
```

#### ProxyConfig (Persisted Settings)

```typescript
interface ProxyConfig {
  mode: ProxyMode;       // kiroSdlc.proxy.mode — default: "system"
  host: string;          // kiroSdlc.proxy.host — default: ""
  port: number;          // kiroSdlc.proxy.port — default: 8080
  bypass: string;        // kiroSdlc.proxy.bypass — default: "localhost,127.0.0.1,::1"
}
```

#### ProxyCredentials (SecretStorage — NEVER in settings JSON)

```typescript
interface ProxyCredentials {
  username: string;      // SecretStorage key: "kiroSdlc.proxy.username"
  password: string;      // SecretStorage key: "kiroSdlc.proxy.password"
}
```

#### ProxyState (Webview State — sent to UI)

```typescript
interface ProxyState {
  mode: ProxyMode;
  host: string;
  port: number;
  bypass: string;
  hasCredentials: boolean;       // true if credentials exist in SecretStorage
  username: string;              // username (not password) sent to webview for display
  detectedProxyUrl: string | null;  // system-detected proxy URL (mode=system)
  detectedBypass: string | null;    // system-detected NO_PROXY value
}
```

#### ProxyTestResult

```typescript
interface ProxyTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}
```

### 5.2 VS Code Configuration Schema

```json
{
  "kiroSdlc.proxy.mode": {
    "type": "string",
    "enum": ["none", "system", "manual"],
    "default": "system",
    "description": "Proxy mode: none (direct), system (auto-detect), manual (user-configured)"
  },
  "kiroSdlc.proxy.host": {
    "type": "string",
    "default": "",
    "description": "Proxy server hostname or IP address"
  },
  "kiroSdlc.proxy.port": {
    "type": "number",
    "default": 8080,
    "minimum": 1,
    "maximum": 65535,
    "description": "Proxy server port"
  },
  "kiroSdlc.proxy.bypass": {
    "type": "string",
    "default": "localhost,127.0.0.1,::1",
    "description": "Comma-separated list of hosts that bypass the proxy"
  }
}
```

### 5.3 SecretStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `kiroSdlc.proxy.username` | string | Proxy authentication username |
| `kiroSdlc.proxy.password` | string | Proxy authentication password |

---

## 6. API Specifications (postMessage Protocol)

### 6.1 Webview → Extension Host Messages

| Message Type | Payload | Description | Triggered By |
|-------------|---------|-------------|--------------|
| `getProxyState` | `{}` | Request current proxy configuration state | Tab activation / ready |
| `setProxyMode` | `{ mode: ProxyMode }` | Change proxy mode | Radio button change |
| `saveProxy` | `{ host: string, port: number, bypass: string }` | Save proxy host/port/bypass | Save button click |
| `saveProxyCredentials` | `{ username: string, password: string }` | Store credentials in SecretStorage | Save Credentials button |
| `clearProxyCredentials` | `{}` | Delete credentials from SecretStorage | Clear Credentials button |
| `testProxyConnection` | `{ mode: ProxyMode, host: string, port: number, username?: string, password?: string }` | Test connectivity with form values | Test Connection button |
| `detectSystemProxy` | `{}` | Trigger system proxy detection refresh | System mode selection / Refresh |

### 6.2 Extension Host → Webview Messages

| Message Type | Payload | Description | Triggered By |
|-------------|---------|-------------|--------------|
| `proxyState` | `ProxyState` | Full proxy state for UI rendering | Response to `getProxyState` |
| `proxyModeChanged` | `{ mode: ProxyMode, success: boolean }` | Confirm mode change | After `setProxyMode` |
| `proxySaved` | `{ success: boolean, error?: string }` | Confirm settings save | After `saveProxy` |
| `proxyCredentialsSaved` | `{ success: boolean, error?: string }` | Confirm credential save | After `saveProxyCredentials` |
| `proxyCredentialsCleared` | `{ success: boolean }` | Confirm credential deletion | After `clearProxyCredentials` |
| `proxyTestResult` | `ProxyTestResult` | Connectivity test result | After `testProxyConnection` |
| `systemProxyDetected` | `{ url: string | null, bypass: string | null }` | System proxy detection result | After `detectSystemProxy` |

### 6.3 Message Flow Examples

**Save Proxy Configuration:**
```
Webview                          Extension Host
  |                                    |
  |--- { type: "saveProxy",           |
  |      host: "proxy.corp.com",      |
  |      port: 8080,                  |
  |      bypass: "localhost,*.local" } |
  |                                    |
  |    [validates → saves config →     |
  |     updates ProxyAgent]            |
  |                                    |
  |<-- { type: "proxySaved",           |
  |      success: true }               |
```

**Test Proxy Connection:**
```
Webview                          Extension Host
  |                                    |
  |--- { type: "testProxyConnection",  |
  |      mode: "manual",              |
  |      host: "proxy.corp.com",      |
  |      port: 8080,                  |
  |      username: "user",            |
  |      password: "pass" }           |
  |                                    |
  |    [creates temp ProxyAgent →      |
  |     sends test request →           |
  |     measures latency]              |
  |                                    |
  |<-- { type: "proxyTestResult",      |
  |      success: true,                |
  |      message: "Connected",         |
  |      latencyMs: 142 }             |
```

---

## 7. UI Specifications

### 7.1 Tab Bar Modification

Add 3rd tab button to existing tab bar:

```html
<button class="tab-btn" id="tab-proxy" data-tab="pane-proxy" role="tab" aria-selected="false">
  🔗 Proxy
</button>
```

### 7.2 Proxy Tab Layout (pane-proxy)

#### Section 1: Proxy Mode

| No. | Element | Type | ID | Default | Behavior |
|-----|---------|------|----|---------|----------|
| 1 | Section Title | H2 | — | "🔗 Proxy Configuration" | Static |
| 2 | Mode Description | P | — | "Configure network proxy..." | Static helper text |
| 3 | Radio: None | Radio input | `proxy-mode-none` | unchecked | Disables all proxy fields |
| 4 | Radio: System | Radio input | `proxy-mode-system` | checked (default) | Shows detected proxy (read-only) |
| 5 | Radio: Manual | Radio input | `proxy-mode-manual` | unchecked | Enables all manual fields |
| 6 | System Proxy Info | Label (monospace) | `system-proxy-info` | — | Shows detected URL or "No system proxy detected" |

#### Section 2: Manual Proxy Configuration (card)

| No. | Element | Type | ID | Placeholder | Validation |
|-----|---------|------|----|-------------|------------|
| 7 | Proxy Host | Input (text) | `proxy-host-input` | "proxy.company.com" | Non-empty, valid hostname/IP |
| 8 | Proxy Port | Input (number) | `proxy-port-input` | "8080" | Integer 1-65535 |
| 9 | URL Preview | Label (monospace) | `proxy-url-preview` | — | Read-only composed URL |
| 10 | Bypass List | Textarea | `proxy-bypass-input` | "localhost,127.0.0.1,*.internal.com" | Comma-separated |
| 11 | Bypass Help | Label (small) | — | — | "Comma-separated. Supports wildcards: *.domain.com" |

#### Section 3: Proxy Authentication (card)

| No. | Element | Type | ID | Placeholder | Validation |
|-----|---------|------|----|-------------|------------|
| 12 | Username | Input (text) | `proxy-username-input` | "username" | Must pair with password |
| 13 | Password | Input (password) | `proxy-password-input` | "Enter proxy password..." | Must pair with username |
| 14 | Toggle Password | Button (icon) | `toggle-proxy-password` | — | Toggle visibility 👁 |
| 15 | Credential Status | Label | `proxy-credential-status` | — | "✅ Credentials saved" or "⚠️ Not saved" |
| 16 | Save Credentials | Button | `save-proxy-credentials-btn` | — | Primary style |
| 17 | Clear Credentials | Button | `clear-proxy-credentials-btn` | — | Danger-outline style |

#### Section 4: Connection Test (card)

| No. | Element | Type | ID | Behavior |
|-----|---------|------|----|----------|
| 18 | Test Connection | Button | `test-proxy-btn` | Secondary style; shows spinner when testing |
| 19 | Save Proxy | Button | `save-proxy-btn` | Primary style |
| 20 | Test Result | Div | `proxy-test-result` | Color-coded: green=success, red=failure |

### 7.3 UI States

| State | Mode Radio | Host/Port | Auth Fields | Bypass | Test Btn | Save Btn |
|-------|-----------|-----------|-------------|--------|----------|----------|
| Mode = None | None selected | Disabled | Disabled | Disabled | Disabled | Enabled |
| Mode = System | System selected | Disabled | Disabled | Enabled | Enabled | Enabled |
| Mode = Manual | Manual selected | Enabled | Enabled | Enabled | Enabled | Enabled |
| Testing | Any | Frozen | Frozen | Frozen | Loading | Disabled |
| Saving | Any | Frozen | Frozen | Frozen | Disabled | Loading |

### 7.4 CSS Classes (consistent with existing settings.css)

- `.card` — Section wrapper (existing)
- `.form-group` — Label + input wrapper (existing)
- `.btn.primary` — Primary action button (existing)
- `.btn.secondary` — Secondary action button (existing)
- `.btn.danger-outline` — Destructive action (existing)
- `.status-indicator` — Result display area (existing)
- `.input-with-toggle` — Input + icon button wrapper (existing)
- `.radio-group` — New: radio button group styling
- `.proxy-url-preview` — New: monospace URL preview label

---

## 8. Error Handling

### 8.1 Error Codes

| Code | Category | Message (User-Facing) | Trigger |
|------|----------|----------------------|---------|
| PROXY_ERR_001 | Validation | "Proxy host is required in Manual mode" | Save with empty host, mode=manual |
| PROXY_ERR_002 | Validation | "Port must be a number between 1 and 65535" | Invalid port value |
| PROXY_ERR_003 | Validation | "Both username and password are required" | Partial credentials |
| PROXY_ERR_004 | Connection | "Connection timed out — proxy may be unreachable" | Test timeout (10s) |
| PROXY_ERR_005 | Connection | "Connection refused — verify proxy host and port" | ECONNREFUSED |
| PROXY_ERR_006 | Connection | "Cannot resolve proxy hostname" | DNS resolution failure (ENOTFOUND) |
| PROXY_ERR_007 | Connection | "SSL error — proxy may require specific certificate configuration" | TLS handshake failure |
| PROXY_ERR_008 | Auth | "Proxy requires authentication — enter credentials" | HTTP 407 response |
| PROXY_ERR_009 | Auth | "Proxy authentication failed — verify username and password" | 407 after auth attempt |
| PROXY_ERR_010 | Storage | "Failed to save proxy settings" | VS Code config write failure |
| PROXY_ERR_011 | Storage | "Failed to save credentials" | SecretStorage write failure |
| PROXY_ERR_012 | Detection | "System proxy URL appears invalid" | Malformed env var value |
| PROXY_ERR_013 | Runtime | "Proxy connection failed: {detail}" | Generic proxy error during normal operation |

### 8.2 Error Handling Strategy

| Layer | Strategy |
|-------|----------|
| Webview (UI) | Display inline errors for validation; show status-indicator for async errors |
| SettingsMessageHandler | Catch all errors in handler methods; post error messages back to webview; never throw unhandled |
| HttpClient (runtime) | Catch proxy-specific errors; wrap in user-friendly messages; log technical details (without credentials) |
| ProxyAgent creation | Validate config before creating agent; fall back to direct connection on invalid config |

---

## 9. State Diagrams

### 9.1 Proxy Configuration State Machine

```
States:
  [UNCONFIGURED] → [CONFIGURED] → [TESTING] → [ACTIVE]
                                       ↓
                                  [TEST_FAILED]

Transitions:

  UNCONFIGURED → CONFIGURED
    Trigger: User saves proxy settings (host + port) OR system proxy detected
    Action: Persist config; create ProxyAgent instance

  CONFIGURED → TESTING
    Trigger: User clicks "Test Connection"
    Action: Create temporary ProxyAgent; send test request; show loading

  TESTING → ACTIVE
    Trigger: Test request returns success (HTTP 200)
    Action: Display success + latency; ProxyAgent ready for use

  TESTING → TEST_FAILED
    Trigger: Test request fails (timeout, refused, DNS, auth)
    Action: Display error message; ProxyAgent NOT applied

  TEST_FAILED → TESTING
    Trigger: User modifies config and clicks "Test Connection" again
    Action: Retry with new config

  TEST_FAILED → CONFIGURED
    Trigger: User saves without re-testing
    Action: Config persisted; ProxyAgent created (untested)

  CONFIGURED → ACTIVE
    Trigger: User saves without testing (skip test)
    Action: ProxyAgent applied immediately

  ACTIVE → CONFIGURED
    Trigger: User changes proxy settings
    Action: Previous ProxyAgent invalidated; new config pending save

  ACTIVE → UNCONFIGURED
    Trigger: User changes mode to "None"
    Action: ProxyAgent removed; direct connection used

  ANY → UNCONFIGURED
    Trigger: User selects mode = "None"
    Action: All proxy fields cleared/disabled; direct connection

Notes:
  - "Test Connection" is OPTIONAL — user can save and apply without testing
  - ACTIVE state means HttpClient uses the configured ProxyAgent
  - Configuration changes take effect immediately after save (no restart)
```

### 9.2 Credential Lifecycle States

```
States:
  [NO_CREDENTIALS] → [CREDENTIALS_SAVED] → [CREDENTIALS_APPLIED]

Transitions:

  NO_CREDENTIALS → CREDENTIALS_SAVED
    Trigger: User enters username + password, clicks "Save Credentials"
    Action: Store in SecretStorage; show "✅ Credentials saved"

  CREDENTIALS_SAVED → CREDENTIALS_APPLIED
    Trigger: Next outbound request through proxy
    Action: Inject Proxy-Authorization: Basic {base64(user:pass)} header

  CREDENTIALS_APPLIED → NO_CREDENTIALS
    Trigger: User clicks "Clear Credentials"
    Action: Delete from SecretStorage; remove auth from ProxyAgent

  CREDENTIALS_APPLIED → CREDENTIALS_SAVED
    Trigger: User updates credentials (new username/password)
    Action: Overwrite in SecretStorage; next request uses new credentials
```

### 9.3 System Proxy Detection States

```
States:
  [DETECTING] → [DETECTED] | [NOT_DETECTED]

Transitions:

  DETECTING → DETECTED
    Trigger: Found proxy URL in env vars or VS Code settings
    Action: Display URL in read-only field; apply to ProxyAgent

  DETECTING → NOT_DETECTED
    Trigger: No proxy found in any source
    Action: Display "No system proxy detected — using direct connection"

  DETECTED → DETECTING
    Trigger: User re-opens Proxy tab or switches to System mode
    Action: Re-read environment variables (may have changed)

  NOT_DETECTED → DETECTING
    Trigger: User re-opens Proxy tab or manually triggers refresh
    Action: Re-check all sources
```

---

## 10. Security Requirements

### 10.1 Data Sensitivity Classification

| Data Type | Classification | Requirement |
|-----------|---------------|-------------|
| Proxy host/port | Internal | Stored in workspace settings (visible in JSON) — acceptable |
| Proxy mode | Internal | Stored in workspace settings — acceptable |
| Bypass list | Internal | Stored in workspace settings — acceptable |
| Proxy username | Confidential | MUST use SecretStorage — NEVER in settings JSON |
| Proxy password | Restricted | MUST use SecretStorage — NEVER in settings JSON, NEVER in logs |

### 10.2 Security Controls

| Control | Implementation |
|---------|---------------|
| Credential storage | VS Code SecretStorage API (encrypted, per-extension) |
| Credential exposure prevention | Password never sent to webview; only `hasCredentials: boolean` flag |
| Log masking | Proxy password masked as "***" in all log output |
| Webview isolation | CSP prevents external connections from webview; credentials handled only in extension host |
| Auth header injection | Proxy-Authorization header built in extension host, never exposed to webview |

---

## 11. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | Proxy overhead < 200ms per request | Request latency with proxy ≤ direct + 200ms |
| Performance | Proxy tab init < 100ms | Tab renders and loads state in < 100ms |
| Performance | System proxy detection < 50ms | Env var + config reads complete in < 50ms |
| Reliability | Graceful fallback on proxy failure | Extension does not crash; shows clear error message |
| Reliability | Settings persist across restarts | Workspace settings + SecretStorage survive VS Code restart |
| Usability | Zero-config for system proxy | System mode auto-detects; no manual input needed |
| Usability | Instant feedback on mode change | UI updates immediately on radio selection |
| Compatibility | HTTP and HTTPS proxy URLs | Both `http://` and `https://` proxy schemes supported |
| Compatibility | VS Code 1.85+ | Minimum version supported |
| Maintainability | Proxy logic encapsulated | Dedicated ProxyConfigService; HttpClient uses abstraction layer |

---

## 12. Testing Considerations

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Save valid proxy config | host="proxy.com", port=8080 | Settings persisted; proxySaved success | High |
| TC-02 | Save invalid port | port=99999 | Validation error PROXY_ERR_002 | High |
| TC-03 | Save with empty host (manual mode) | host="", mode=manual | Validation error PROXY_ERR_001 | High |
| TC-04 | Switch mode None → Manual | Click Manual radio | Fields enabled; mode persisted | High |
| TC-05 | Save partial credentials | username="user", password="" | Validation error PROXY_ERR_003 | High |
| TC-06 | Save full credentials | username="user", password="pass" | Stored in SecretStorage; status ✅ | High |
| TC-07 | Clear credentials | Click Clear | SecretStorage cleared; status ⚠️ | Medium |
| TC-08 | Test connection success | Valid proxy config | "✅ Connected (Xms)" | High |
| TC-09 | Test connection timeout | Unreachable proxy | PROXY_ERR_004 after 10s | High |
| TC-10 | Test connection auth required | Proxy requires auth, no creds | PROXY_ERR_008 | Medium |
| TC-11 | System proxy detection (env var set) | HTTP_PROXY=http://proxy:3128 | Detected URL shown | High |
| TC-12 | System proxy detection (nothing set) | No env vars, no VS Code config | "No system proxy detected" | Medium |
| TC-13 | Bypass list with wildcard | bypass="*.internal.com" | Request to api.internal.com skips proxy | Medium |
| TC-14 | Mode change applies immediately | Switch from manual to none | Next request uses direct connection | High |
| TC-15 | Credentials not in settings JSON | Save credentials | grep settings.json → no proxy password | High |

---

## 13. Appendix

### 13.1 Processing Logic: Proxy Resolution Algorithm

**Trigger:** Any outbound HTTP/HTTPS request from HttpClient
**Input:** Target URL, ProxyConfig, ProxyCredentials (if any)
**Output:** Request sent via ProxyAgent or direct

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read `kiroSdlc.proxy.mode` from workspace config | Default to "system" if missing |
| 2 | If mode = "none" → use direct `fetch()` (no proxy) | — |
| 3 | If mode = "system" → detect system proxy (env vars → VS Code) | If none detected → direct connection |
| 4 | If mode = "manual" → compose URL from `host:port` | If host empty → direct connection + log warning |
| 5 | Check target URL against bypass list | If match → skip proxy, use direct |
| 6 | Check for saved credentials in SecretStorage | If present → include in ProxyAgent auth |
| 7 | Create undici ProxyAgent with resolved proxy URL | On creation error → log + direct fallback |
| 8 | Execute request via ProxyAgent | On 407 → notify user (PROXY_ERR_008) |

### 13.2 Bypass List Matching Algorithm

```
function shouldBypass(targetHost: string, bypassList: string): boolean {
  const entries = bypassList.split(",").map(e => e.trim()).filter(Boolean);
  for (const entry of entries) {
    if (entry.startsWith("*.")) {
      // Wildcard match: *.domain.com matches sub.domain.com
      const suffix = entry.slice(1); // ".domain.com"
      if (targetHost.endsWith(suffix) || targetHost === entry.slice(2)) {
        return true;
      }
    } else {
      // Exact match
      if (targetHost === entry) {
        return true;
      }
    }
  }
  return false;
}
```

### 13.3 System Proxy Detection Priority

| Priority | Source | Environment Variable / Setting |
|----------|--------|-------------------------------|
| 1 (highest) | Env var | `HTTPS_PROXY` or `https_proxy` |
| 2 | Env var | `HTTP_PROXY` or `http_proxy` |
| 3 | VS Code | `http.proxy` (built-in setting) |
| 4 (lowest) | None | No proxy detected → direct connection |

Bypass detection:

| Priority | Source | Variable |
|----------|--------|----------|
| 1 | Env var | `NO_PROXY` or `no_proxy` |
| 2 | Config | `kiroSdlc.proxy.bypass` (user-configured) |

### 13.4 Change Log from BRD

| Change | Clarification |
|--------|---------------|
| System proxy detection priority | Specified explicit priority order (BRD mentioned sources but not priority) |
| Test uses unsaved form values | Clarified that test does NOT require save first (BR-09) |
| Password never sent to webview | Added security control not explicitly in BRD |
| ProxyAgent via undici | Specified implementation mechanism for Node.js fetch proxy support |
| Bypass matching algorithm | Specified exact wildcard matching semantics |

---

*End of FSD — SA4E-PROXY v1.0*
