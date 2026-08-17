# Business Requirements Document (BRD)

## SA4E Extension — SA4E-100: Curl Fallback for System Proxy + Copy to Manual

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-100 |
| Title | Curl Fallback for System Proxy + Copy to Manual |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | BA Agent | Initiate document — auto-generated from Jira ticket SA4E-100. Reflects existing implementation. |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This BRD documents the "Curl Fallback for System Proxy + Copy to Manual" feature for the SA4E VS Code extension. The feature addresses a critical connectivity gap in corporate environments where Endpoint Detection and Response (EDR) tools such as Trellix and CrowdStrike block `node.exe` from making HTTP requests through the corporate proxy, while `curl.exe` (a Windows system binary) remains whitelisted.

The scope includes:
1. **CurlTransport** — A curl.exe subprocess HTTP driver that bypasses EDR restrictions and supports NTLM SSO authentication via Skyhigh SWG proxy
2. **Dual-driver proxy test strategy** — ProxyTestService tries undici/native HTTP first, then falls back to curl subprocess when native fails
3. **Copy to Manual** — A UI action that copies detected system proxy settings to Manual mode, allowing users to add explicit credentials

### 1.2 Out of Scope

- Modification of EDR whitelisting policies
- macOS/Linux curl NTLM SSO (Windows-specific feature)
- NTLM credential management (only SSO via logged-in Windows user)
- Proxy auto-configuration (PAC) file parsing
- Custom CA certificate management for curl

### 1.3 Preliminary Requirement

- Windows OS with `curl.exe` available (Windows 10+ includes curl.exe by default)
- Corporate proxy environment (Skyhigh SWG, McAfee Web Gateway, or similar NTLM-capable proxy)
- VS Code extension proxy detection service (already implemented)
- User logged in to Windows domain for NTLM SSO credentials

---

## 2. Business Requirements

### 2.1 High Level Process Map

The extension proxy connectivity operates in two modes:
- **System Mode** — Automatically detects system proxy and routes traffic through it using undici with curl fallback
- **Manual Mode** — User explicitly configures proxy host, port, and credentials

When the extension needs to test or use proxy connectivity:
1. System proxy URL is resolved (via VS Code proxy resolver or OS detection)
2. Connection is attempted using undici ProxyAgent (fast path)
3. If undici fails (EDR blocks node.exe), the system falls back to curl.exe subprocess
4. Curl uses `--proxy-ntlm -U :` to authenticate with current Windows NTLM credentials (SSO)
5. User can optionally copy detected system proxy to Manual mode for credential customization

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| US-01 | As a developer behind corporate EDR, I want the extension to still connect through proxy even when node.exe HTTP is blocked | MUST HAVE | SA4E-100 |
| US-02 | As a user, I want to test proxy connectivity with automatic NTLM SSO (no password entry) | MUST HAVE | SA4E-100 |
| US-03 | As a user, I want to copy detected system proxy to Manual mode so I can add credentials | SHOULD HAVE | SA4E-100 |
| US-04 | As a user, I want the extension to automatically fallback to curl when undici fails | MUST HAVE | SA4E-100 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Step 1:** User activates extension in corporate environment with EDR-restricted proxy

**Step 2:** Extension detects system proxy configuration (host, port, bypass list)

**Step 3:** User initiates proxy connectivity test (or extension performs automatic connection)

**Step 4:** ProxyTestService attempts connection via undici ProxyAgent (native Node.js HTTP)

**Step 5:** If undici succeeds → connection established, report latency

**Step 6:** If undici fails (ECONNREFUSED, timeout, EDR block) → CurlTransport fallback activates

**Step 7:** CurlTransport executes `curl.exe` with `--proxy-ntlm -U :` for automatic NTLM SSO

**Step 8:** Curl response is parsed (skipping 407 NTLM challenge + 200 Connection Established intermediates)

**Step 9:** If curl succeeds → connection established via curl, report latency with "(via curl)" suffix

**Step 10:** If both fail → report error with most informative message (curl error preferred)

> **Note:** curl.exe is a Windows system binary whitelisted by all major EDR solutions. The `--proxy-ntlm -U :` flag instructs curl to use the current Windows login session NTLM credentials, providing true SSO without any password prompt.

---

#### STORY 1: EDR-Resilient Proxy Connectivity (US-01)

> As a developer behind corporate EDR, I want the extension to still connect through proxy even when node.exe HTTP is blocked, so that I can use the extension without requesting IT exceptions.

**Requirement Details:**

1. When undici/native Node.js HTTP fails to connect through the corporate proxy, the system MUST automatically attempt connection via curl.exe subprocess
2. The curl.exe binary is a Windows system binary (C:\Windows\System32\curl.exe) that is whitelisted by EDR solutions (Trellix, CrowdStrike)
3. The fallback mechanism MUST be transparent to the user — no manual intervention required
4. The system MUST use `execFile` (not shell execution) to safely handle URLs containing special characters like `&`

**Acceptance Criteria:**

1. Given undici connection fails with ECONNREFUSED/timeout, when curl.exe is available, then the system automatically retries via curl subprocess
2. Given curl.exe is not available on the system, then the system returns the undici error without crashing
3. Given EDR blocks node.exe HTTP but allows curl.exe, then the extension successfully connects through proxy via curl fallback
4. Given the URL contains special characters (&, ?, #), then execFile handles them safely without shell injection

---

#### STORY 2: NTLM SSO Proxy Authentication (US-02)

> As a user, I want to test proxy connectivity with automatic NTLM SSO (no password entry), so that I can verify my proxy configuration works without sharing credentials.

**Requirement Details:**

1. The curl transport MUST support `--proxy-ntlm -U :` flag to use current Windows NTLM credentials
2. The colon (`:`) in `-U :` means "use the current Windows login session credentials" — true Single Sign-On
3. The system MUST correctly parse NTLM negotiation responses: skip 407 Proxy Authentication Required (NTLM challenge) and 200 Connection Established intermediate headers
4. When explicit credentials are provided (username:password), the system MUST use those instead of NTLM SSO
5. The proxy test MUST report latency in milliseconds

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| proxyUrl | string | Yes | Proxy server URL | `http://proxy.corp.com:8080` |
| targetUrl | string | No | URL to test connectivity against | `https://www.google.com` |
| proxyAuth | string | No | Explicit user:pass (null = NTLM SSO) | `domain\user:password` |
| latencyMs | number | N/A (output) | Round-trip time in milliseconds | `350` |

**Acceptance Criteria:**

1. Given no explicit credentials provided, when testing via curl, then `--proxy-ntlm -U :` is used for SSO
2. Given explicit credentials provided (user:pass), when testing via curl, then `-U user:pass` is used with basic auth
3. Given the proxy returns 407 NTLM challenge followed by 200 Connection Established, when parsing curl output, then intermediate headers are skipped and final response is parsed correctly
4. Given a successful connection, when test completes, then latency in ms is reported accurately

---

#### STORY 3: Copy Detected Proxy to Manual Mode (US-03)

> As a user, I want to copy detected system proxy to Manual mode so I can add credentials, allowing me to customize proxy authentication.

**Requirement Details:**

1. The "Copy to Manual" action MUST read the currently detected system proxy URL
2. The system MUST parse the detected URL into host and port components
3. The system MUST switch the proxy mode from "system" to "manual"
4. The system MUST save the parsed host, port, and bypass list to manual mode configuration
5. After copy, the webview MUST be notified to populate fields with the copied values
6. If no system proxy is detected, the action MUST return an error message

**Acceptance Criteria:**

1. Given system proxy detected as `http://proxy.corp.com:8080`, when user clicks "Copy to Manual", then mode switches to Manual and fields populate with host=`proxy.corp.com`, port=`8080`
2. Given bypass list exists in system proxy, when copying, then bypass list is preserved in manual mode
3. Given no system proxy detected, when user clicks "Copy to Manual", then error message "No system proxy detected to copy" is shown
4. Given copy succeeds, when webview receives response, then proxy state refreshes with new manual settings

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Copy to Manual | Button | No | Copies system proxy to manual mode fields | Only visible in System proxy mode |
| 2 | Host field | Input | Yes (in manual) | Proxy hostname | Auto-populated after copy |
| 3 | Port field | Input | Yes (in manual) | Proxy port number | Auto-populated after copy |
| 4 | Bypass field | Input | No | Bypass list (comma-separated) | Auto-populated after copy |
| 5 | Username field | Input | No | Manual credential username | Empty after copy — user fills in |
| 6 | Password field | Input | No | Manual credential password | Empty after copy — user fills in |

---

#### STORY 4: Automatic Curl Fallback Strategy (US-04)

> As a user, I want the extension to automatically fallback to curl when undici fails, so that connectivity issues are resolved without my intervention.

**Requirement Details:**

1. ProxyTestService implements a dual-driver strategy: undici first, curl fallback
2. The undici attempt MUST complete (success or failure) before curl is attempted — NOT parallel
3. On curl success after undici failure, the result message MUST include "(via curl)" suffix to indicate fallback was used
4. If both undici and curl fail, the system MUST return the curl error (more informative for proxy environments)
5. A dedicated `testWithCurlOnly` method MUST be available for explicit curl-only testing from the UI
6. Connection timeout for both drivers is 10 seconds

**Acceptance Criteria:**

1. Given undici succeeds, when testing proxy, then curl is NOT invoked (fast path)
2. Given undici fails and curl succeeds, when testing proxy, then result shows success with "(via curl)" suffix
3. Given both undici and curl fail, when testing proxy, then curl error message is returned (not undici error)
4. Given curl.exe is not available on the system, when fallback is attempted, then error "curl not available — cannot use curl fallback" is returned
5. Given explicit curl-only test is requested, when testing, then only curl is used (undici skipped)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| curl.exe (Windows) | System | N/A | Windows system binary (C:\Windows\System32\curl.exe), included since Windows 10. Required for fallback transport. |
| undici (ProxyAgent) | Library | N/A | Node.js HTTP client library used as primary proxy transport |
| VS Code Proxy Resolver | System | N/A | VscodeProxyResolverService for per-URL proxy resolution in System mode |
| ProxyDetectionService | Internal | N/A | Detects system proxy configuration (URL, bypass list) |
| ProxyConfigService | Internal | N/A | Manages proxy mode and credential storage |
| Windows NTLM Domain | Infrastructure | N/A | User must be logged into Windows domain for SSO to work |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| End Users | Corporate developers | Use extension behind proxy | Target audience |
| IT Security | Corporate security teams | Manage EDR policies | Context |
| Extension Team | SA4E Development Team | Implement and maintain | Development |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| curl.exe not available on older Windows | Medium | Low | Check availability before fallback; graceful error message |
| NTLM SSO fails on non-domain machines | High | Medium | Fallback to explicit credentials via Manual mode + "Copy to Manual" |
| EDR blocks curl.exe in future | High | Low | Feature designed as fallback; undici remains primary. Monitor EDR policy changes. |
| Proxy returns non-standard NTLM responses | Medium | Low | Robust parser skips all intermediate 407/200-Connect headers, takes last real response |
| URL with special characters causes issues | Medium | Low | execFile (not shell) handles special chars safely |

### 5.2 Assumptions

- Windows 10+ includes curl.exe at `C:\Windows\System32\curl.exe`
- EDR tools whitelist curl.exe as a system binary
- Corporate NTLM proxy supports standard `Proxy-Authorization: NTLM` negotiation
- Users are logged into Windows domain when using NTLM SSO
- The proxy supports HTTP CONNECT tunneling for HTTPS targets
- NEVER use `-X GET` with HTTPS proxy (breaks CONNECT tunnel causing timeout)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Proxy test timeout <= 10 seconds | Both undici and curl paths must complete within 10s each |
| Performance | Curl latency overhead < 500ms vs native | Subprocess spawn overhead acceptable for fallback scenario |
| Security | No credentials in command line args (for SSO) | `--proxy-ntlm -U :` uses Windows credential store, not plaintext |
| Security | execFile prevents shell injection | URLs with `&`, `;`, `|` cannot trigger shell commands |
| Reliability | curl.exe availability check before fallback | `CurlTransport.isAvailable()` validates binary exists (5s timeout) |
| Compatibility | Windows 10+ support | curl.exe included since Windows 10 build 17063 |
| Usability | Fallback transparent to user | No manual intervention; result indicates "(via curl)" for visibility |
| Buffer | Max response buffer 20MB | `maxBuffer: 20 * 1024 * 1024` for curl subprocess output |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-100 | Curl Fallback for System Proxy + Copy to Manual | In Progress | Story | Main ticket |

---

## 8. Appendix

### Technical Constraints (Implementation Rules)

| Rule | Rationale |
|------|-----------|
| NEVER use `-X GET` with HTTPS proxy | Breaks CONNECT tunnel causing timeout. Curl default method is GET for HTTPS without `-X`. |
| Use `-I` for HEAD requests (not `-X HEAD`) | `-X HEAD` may cause issues with some proxies |
| Use `execFile` (not `exec` or shell) | Safe with `&` in URLs; prevents shell injection |
| Skip 407 NTLM + 200 Connection Established | NTLM negotiation produces intermediate response blocks that must be parsed out |
| `--proxy-ntlm -U :` for NTLM SSO | Colon means "use current Windows session credentials" |
| Parse response from last HTTP block backwards | Multiple response blocks in output; final non-407/non-CONNECT block is the real response |

### Glossary

| Term | Definition |
|------|------------|
| EDR | Endpoint Detection and Response — security software (Trellix, CrowdStrike) that monitors and blocks suspicious process activities |
| NTLM SSO | NT LAN Manager Single Sign-On — automatic authentication using current Windows domain login session |
| Skyhigh SWG | Skyhigh Secure Web Gateway (formerly McAfee Web Gateway) — corporate HTTP proxy with NTLM authentication |
| undici | Node.js HTTP client library, provides ProxyAgent for proxy connectivity |
| CONNECT tunnel | HTTP CONNECT method used to establish an encrypted tunnel through a proxy for HTTPS traffic |
| ProxyAgent | undici class that routes HTTP requests through a proxy server |
| CurlTransport | Extension module that executes HTTP requests via curl.exe subprocess |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
| 2 | Business Flow Diagram | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| CurlTransport Implementation | extension/src/proxy/CurlTransport.ts |
| ProxyTestService Implementation | extension/src/proxy/ProxyTestService.ts |
| ProxyMessageHandler Implementation | extension/src/proxy/ProxyMessageHandler.ts |
