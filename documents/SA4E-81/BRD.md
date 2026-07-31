# Business Requirements Document (BRD)

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
| 1.0 | 2025-01-27 | BA Agent | Initiate document — auto-generated from ticket SA4E-PROXY |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Trong môi trường doanh nghiệp (enterprise), tất cả outbound network traffic phải đi qua proxy server do chính sách bảo mật mạng. Extension SDLC Agents 4 Enterprise hiện tại sử dụng `fetch()` trực tiếp trong `HttpClient` mà không hỗ trợ proxy, dẫn đến việc extension không hoạt động được trong các môi trường corporate network.

Scope của CR này bao gồm:
- Thêm tab "Proxy" mới vào Settings Panel hiện có
- Cho phép user cấu hình proxy settings (host, port, auth, bypass list)
- Hỗ trợ 3 chế độ proxy: None / System / Manual
- Tích hợp proxy vào `HttpClient` cho tất cả outbound requests
- Cung cấp tính năng test connectivity qua proxy
- Lưu trữ settings bền vững (persist across sessions)

### 1.2 Out of Scope

- SOCKS proxy support (chỉ HTTP/HTTPS proxy)
- PAC file auto-configuration
- Per-request proxy routing (tất cả requests dùng cùng proxy)
- Proxy load balancing hoặc failover
- Certificate pinning hoặc custom CA certificate management

### 1.3 Preliminary Requirement

- VS Code Extension đã có Settings Panel hoạt động với 2 tabs (LLM Provider, Server Settings)
- `HttpClient` class tồn tại tại `extension/src/proxy/HttpClient.ts`
- VS Code SecretStorage API khả dụng (đã được sử dụng cho API keys)
- Node.js v20+ runtime (native `fetch()` có hỗ trợ)

---

## 2. Business Requirements

### 2.1 High Level Process Map

User mở Settings Panel → chuyển sang tab "Proxy" → chọn Proxy Mode (None / System / Manual) → nếu Manual thì nhập proxy host:port, auth credentials, bypass list → test connection → save. Từ đó tất cả outbound requests của extension đều đi qua proxy đã cấu hình.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer in enterprise environment, I want to configure HTTP/HTTPS proxy settings so that the extension can communicate through corporate proxy | MUST HAVE | SA4E-PROXY |
| 2 | As a developer, I want to choose between no proxy, system proxy, or manual proxy so that I can use the most appropriate configuration for my network | MUST HAVE | SA4E-PROXY |
| 3 | As a developer, I want to set proxy authentication credentials securely so that the extension can authenticate with proxy servers requiring login | MUST HAVE | SA4E-PROXY |
| 4 | As a developer, I want to configure a bypass list so that internal/local addresses skip the proxy | SHOULD HAVE | SA4E-PROXY |
| 5 | As a developer, I want to test proxy connectivity from the settings panel so that I can verify my configuration works before using the extension | SHOULD HAVE | SA4E-PROXY |
| 6 | As a developer, I want the extension to auto-detect system proxy settings so that I don't have to manually configure proxy in most cases | COULD HAVE | SA4E-PROXY |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User opens Settings Panel via command palette or sidebar button

**Step 2:** User clicks on the "Proxy" tab (new, third tab)

**Step 3:** System displays current proxy configuration (defaults to "System" mode on first use)

**Step 4:** User selects Proxy Mode:
- **None** → All proxy fields disabled, direct connection
- **System** → System-detected proxy displayed (read-only), user can override bypass list
- **Manual** → All proxy fields enabled for manual input

**Step 5:** (If Manual) User enters proxy host and port

**Step 6:** (If Manual, optional) User enters proxy username and password for authentication

**Step 7:** (Optional) User enters bypass list (comma-separated hostnames/IPs)

**Step 8:** User clicks "Test Connection" to verify proxy works

**Step 9:** System attempts connection through configured proxy and displays result (success/fail with latency)

**Step 10:** User clicks "Save" — settings persisted to VS Code workspace settings, credentials to SecretStorage

**Step 11:** All subsequent outbound requests from HttpClient use the configured proxy

> **Note:** When proxy mode is "System", the extension reads environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) and VS Code's built-in `http.proxy` setting. System detection happens at extension activation and when user opens Proxy tab.

---

#### STORY 1: Configure HTTP/HTTPS Proxy

> As a developer in enterprise environment, I want to configure HTTP/HTTPS proxy settings so that the extension can communicate through corporate proxy.

**Requirement Details:**

1. Settings Panel hiển thị tab "Proxy" mới bên cạnh "LLM Provider" và "Server Settings"
2. User nhập Proxy Host (hostname hoặc IP address)
3. User nhập Proxy Port (numeric, 1-65535)
4. Proxy URL tổng hợp theo format: `http://{host}:{port}`
5. Settings áp dụng cho tất cả outbound HTTP/HTTPS requests từ extension:
   - LLM API calls (Anthropic, OpenAI, OpenRouter, etc.)
   - Backend MCP server communication
   - Health check requests
   - Ollama/LM Studio connections (nếu không trong bypass list)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| proxyHost | string | Yes (if Manual) | Proxy server hostname or IP | `proxy.company.com` |
| proxyPort | number | Yes (if Manual) | Proxy server port (1-65535) | `8080` |

**Acceptance Criteria:**

1. User có thể mở Settings Panel → thấy tab "Proxy" mới
2. User nhập proxy host và port → system hiển thị composed URL preview
3. Proxy settings được persist vào VS Code workspace settings (`kiroSdlc.proxy.host`, `kiroSdlc.proxy.port`)
4. Sau khi save, tất cả `HttpClient` requests sử dụng proxy đã cấu hình
5. Invalid port (< 1 hoặc > 65535, non-numeric) → hiển thị validation error

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Tab "Proxy" | Button (tab) | N/A | Tab thứ 3 trong tab bar | Icon: 🌐 hoặc 🔗 |
| 2 | Proxy Host | Input (text) | Yes | Hostname hoặc IP | Placeholder: "proxy.company.com" |
| 3 | Proxy Port | Input (number) | Yes | Port number | Placeholder: "8080", min=1, max=65535 |
| 4 | URL Preview | Label | N/A | Hiển thị composed proxy URL | Read-only, format: http://host:port |

**Validation Rules:**

- Host: non-empty string, valid hostname hoặc IPv4/IPv6 format
- Port: integer, range 1-65535
- Cả host và port phải được nhập khi mode = Manual

**Error Handling:**

- Empty host khi save: "Proxy host is required in Manual mode"
- Invalid port: "Port must be a number between 1 and 65535"
- Connection refused: "Cannot connect through proxy — verify host and port"

---

#### STORY 2: Select Proxy Mode

> As a developer, I want to choose between no proxy, system proxy, or manual proxy so that I can use the most appropriate configuration for my network.

**Requirement Details:**

1. Radio button group hoặc select dropdown với 3 options:
   - **None** — Direct connection, không dùng proxy
   - **System** — Sử dụng system proxy (env vars + VS Code settings)
   - **Manual** — User tự nhập proxy configuration
2. Khi chọn "None": tất cả proxy-related fields disabled, extension connects trực tiếp
3. Khi chọn "System": extension đọc proxy từ system, hiển thị detected proxy (read-only)
4. Khi chọn "Manual": enable tất cả proxy input fields
5. Default mode khi chưa cấu hình: "System" (theo convention VS Code)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| proxyMode | enum | Yes | Proxy mode selection | `none` / `system` / `manual` |

**Acceptance Criteria:**

1. User chọn proxy mode → UI fields enable/disable tương ứng
2. Mode "System" → extension detect và hiển thị system proxy URL (hoặc "No system proxy detected")
3. Mode "None" → extension bỏ qua mọi proxy, connect trực tiếp
4. Mode "Manual" → user phải nhập host:port trước khi save
5. Mode persist across sessions trong workspace settings (`kiroSdlc.proxy.mode`)
6. Thay đổi mode → apply ngay cho requests tiếp theo (không cần restart extension)

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Proxy Mode | Radio group / Select | Yes | 3 options | Default: "System" |
| 2 | System Proxy Info | Label | N/A | Hiển thị detected system proxy | Chỉ hiện khi mode = System |

**Error Handling:**

- System mode nhưng không detect được proxy: Hiển thị info "No system proxy detected — using direct connection"

---

#### STORY 3: Configure Proxy Authentication

> As a developer, I want to set proxy authentication credentials securely so that the extension can authenticate with proxy servers requiring login.

**Requirement Details:**

1. Username field (plaintext input)
2. Password field (masked input, toggle visibility)
3. Credentials stored securely trong VS Code SecretStorage (KHÔNG lưu vào workspace settings)
4. Khi request qua proxy, inject `Proxy-Authorization` header (Basic auth)
5. Credentials là optional — chỉ required khi proxy yêu cầu authentication
6. Clear credentials button để xóa saved credentials

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| proxyUsername | string | No | Proxy auth username | `john.doe` |
| proxyPassword | string (secret) | No | Proxy auth password | `********` |

**Acceptance Criteria:**

1. User nhập username/password → click Save → credentials stored trong SecretStorage
2. Password field masked by default, có toggle button hiển thị/ẩn
3. Sau khi save, indicator hiển thị "✅ Credentials saved"
4. User click "Clear Credentials" → credentials bị xóa khỏi SecretStorage
5. Credentials KHÔNG xuất hiện trong VS Code settings JSON (security requirement)
6. Khi proxy yêu cầu auth → extension tự inject Proxy-Authorization header
7. Auth fail (407) → hiển thị error "Proxy authentication failed — check credentials"

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Username | Input (text) | No | Proxy username | Placeholder: "username" |
| 2 | Password | Input (password) | No | Proxy password | Toggle visibility button |
| 3 | Toggle Password | Button (icon) | N/A | Show/hide password | 👁 icon pattern |
| 4 | Save Credentials | Button | N/A | Persist to SecretStorage | Primary style |
| 5 | Clear Credentials | Button | N/A | Remove saved credentials | Danger-outline style |
| 6 | Credential Status | Label | N/A | Show saved/not saved state | ✅/⚠️ indicator |

**Validation Rules:**

- Username và password phải cùng có hoặc cùng không có (không cho phép chỉ 1 trong 2)

**Error Handling:**

- 407 Proxy Authentication Required: "Proxy requires authentication — enter credentials"
- Auth rejected: "Proxy authentication failed — verify username and password"

---

#### STORY 4: Configure Bypass List

> As a developer, I want to configure a bypass list so that internal/local addresses skip the proxy.

**Requirement Details:**

1. Text input (textarea hoặc multi-line input) cho bypass list
2. Comma-separated list of hostnames, domains, hoặc IP ranges
3. Wildcard support: `*.internal.company.com`
4. Default bypass entries: `localhost`, `127.0.0.1`, `::1`
5. Requests matching bypass list → connect trực tiếp (skip proxy)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| proxyBypass | string | No | Comma-separated bypass hosts | `localhost,127.0.0.1,*.internal.com` |

**Acceptance Criteria:**

1. User nhập bypass list (comma-separated) → save vào workspace settings
2. Default values pre-filled: `localhost,127.0.0.1,::1`
3. Requests tới hosts trong bypass list → skip proxy, connect trực tiếp
4. Wildcard patterns hoạt động (`*.company.com` matches `api.company.com`)
5. Setting persist: `kiroSdlc.proxy.bypass`

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Bypass List | Textarea / Input | No | Comma-separated hosts | Placeholder: "localhost,127.0.0.1,*.internal.com" |
| 2 | Help text | Label | N/A | Instructions for format | "Comma-separated. Supports wildcards: *.domain.com" |

**Validation Rules:**

- Empty bypass list: accepted (all traffic goes through proxy)
- Entries trimmed of whitespace

---

#### STORY 5: Test Proxy Connectivity

> As a developer, I want to test proxy connectivity from the settings panel so that I can verify my configuration works before using the extension.

**Requirement Details:**

1. Button "Test Connection" trong Proxy tab
2. Test thực hiện HTTP request qua proxy tới một endpoint đã biết (ví dụ: health check URL hoặc configurable test URL)
3. Hiển thị kết quả: success (với latency) hoặc failure (với error message)
4. Test sử dụng current proxy configuration (chưa cần save — test với giá trị đang nhập)
5. Timeout: 10 giây

**Acceptance Criteria:**

1. User click "Test Connection" → system gửi request qua proxy
2. Success → "✅ Proxy connection successful (latency: Xms)"
3. Failure → "❌ Connection failed: {error detail}"
4. Button hiển thị loading state khi đang test
5. Test dùng cấu hình hiện tại trên form (không cần save trước)

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Test Connection | Button | N/A | Trigger connectivity test | Secondary style |
| 2 | Test Result | Label/Panel | N/A | Show success/failure | Color-coded indicator |

**Error Handling:**

- Timeout (10s): "Connection timed out — proxy may be unreachable"
- Connection refused: "Connection refused — verify proxy host and port"
- DNS resolution failed: "Cannot resolve proxy hostname"
- SSL/TLS error: "SSL error — proxy may require specific certificate configuration"
- 407 response: "Proxy requires authentication"

---

#### STORY 6: Auto-detect System Proxy

> As a developer, I want the extension to auto-detect system proxy settings so that I don't have to manually configure proxy in most cases.

**Requirement Details:**

1. Khi proxy mode = "System", extension đọc proxy settings từ:
   - Environment variables: `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy`
   - Environment variable: `NO_PROXY`, `no_proxy` (for bypass list)
   - VS Code setting: `http.proxy` (VS Code built-in proxy setting)
2. Hiển thị detected proxy URL trong UI (read-only)
3. Detection chạy khi:
   - Extension activate
   - User mở Proxy tab
   - User chọn "System" mode
4. Nếu không detect được → hiển thị "No system proxy detected"

**Acceptance Criteria:**

1. Extension đọc environment variables `HTTP_PROXY`/`HTTPS_PROXY` (case-insensitive)
2. Extension đọc VS Code `http.proxy` setting
3. UI hiển thị detected proxy URL (read-only text)
4. Nếu không tìm thấy system proxy → "No system proxy detected — using direct connection"
5. System proxy info refresh khi user switch sang System mode

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Detected Proxy | Label | N/A | Show system proxy URL | Read-only, monospace font |
| 2 | Detection Status | Label | N/A | Detected / Not detected | ✅/ℹ️ indicator |

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| VS Code SecretStorage API | System | N/A | Required for secure credential storage (proxy username/password) |
| Node.js v20+ undici/fetch | System | N/A | Native fetch needs proxy agent support; may require `undici` ProxyAgent |
| VS Code Extension API | System | N/A | Workspace configuration API for persisting settings |
| Settings Panel (existing) | System | SA4E (existing) | Must integrate as new tab into existing SettingsPanel |
| HttpClient class | System | SA4E (existing) | Must be modified to route requests through configured proxy |
| SettingsMessageHandler | System | SA4E (existing) | Must handle new proxy-related message types |
| Environment Variables | Infrastructure | N/A | `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` for system detection |
| VS Code http.proxy | System | N/A | Built-in VS Code proxy setting as fallback detection source |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer (User) | Enterprise developers | Configure and use proxy settings | End user |
| IT/Network Admin | Enterprise IT team | Provide proxy server details and credentials | Proxy infrastructure owner |
| Extension Maintainer | Dev Team | Implement and maintain proxy feature | Development |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Node.js native `fetch()` may not support proxy natively | High | High | Use `undici` ProxyAgent or `https-proxy-agent` package |
| Proxy credentials leaked in logs | High | Medium | Never log credentials; mask in debug output; use SecretStorage |
| Corporate proxy với custom CA certificates causes SSL errors | Medium | Medium | Document limitation; consider future CA cert support |
| System proxy detection may miss some configurations | Low | Medium | Provide manual mode as fallback; document supported detection methods |
| Proxy test endpoint may be blocked | Low | Low | Allow configurable test URL; default to well-known public endpoint |

### 5.2 Assumptions

- Enterprise environments sử dụng HTTP/HTTPS forward proxy (không phải SOCKS)
- Proxy authentication sử dụng Basic auth scheme (username:password)
- VS Code SecretStorage API khả dụng và hoạt động trong extension host process
- User có quyền access proxy server (credentials được IT team cung cấp)
- Extension host process có thể đọc environment variables của user session
- Proxy server hỗ trợ CONNECT method cho HTTPS tunneling

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Proxy overhead < 200ms per request | Adding proxy hop should not significantly degrade response time beyond network latency |
| Performance | Settings Panel load time unaffected | Proxy tab initialization < 100ms |
| Security | Credentials never stored in plaintext | MUST use VS Code SecretStorage; never in workspace settings JSON |
| Security | Credentials never logged | Proxy password must be masked in all log output and error messages |
| Security | No credential exposure in webview | Password field masked; credentials handled only in extension host |
| Reliability | Graceful fallback on proxy failure | If proxy unreachable, show clear error; do not crash extension |
| Reliability | Settings persist across VS Code restarts | Workspace settings + SecretStorage ensure persistence |
| Usability | Zero-config for system proxy users | "System" mode auto-detects; no manual input needed |
| Usability | Clear error messages | All proxy errors translated to user-friendly messages |
| Compatibility | Support HTTP and HTTPS proxy URLs | Both `http://proxy:port` and `https://proxy:port` |
| Compatibility | Work with VS Code 1.85+ | Minimum VS Code version supported by extension |
| Maintainability | Proxy logic encapsulated | Proxy configuration isolated in dedicated module; HttpClient uses abstraction |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-PROXY | Proxy Configuration Page | To Do | Story | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Forward Proxy | Server that acts as intermediary for outbound requests from client to internet |
| Bypass List | List of hosts/domains that should connect directly, skipping the proxy |
| System Proxy | Proxy configuration inherited from OS environment variables or VS Code settings |
| CONNECT Method | HTTP method used to establish tunnel through proxy for HTTPS requests |
| SecretStorage | VS Code API for securely storing sensitive data (encrypted, per-extension) |
| ProxyAgent | Node.js agent implementation that routes HTTP/HTTPS requests through a proxy server |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| VS Code SecretStorage API | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| Node.js undici ProxyAgent | https://undici.nodejs.org/#/docs/api/ProxyAgent |
| Existing Settings Panel | extension/src/panels/settings/SettingsPanel.ts |
| Existing HttpClient | extension/src/proxy/HttpClient.ts |
| VS Code Proxy Settings | https://code.visualstudio.com/docs/setup/network#_proxy-server-support |

### Configuration Schema (proposed)

```json
{
  "kiroSdlc.proxy.mode": "system",
  "kiroSdlc.proxy.host": "",
  "kiroSdlc.proxy.port": 8080,
  "kiroSdlc.proxy.bypass": "localhost,127.0.0.1,::1"
}
```

Credentials stored separately in SecretStorage:
- Key: `kiroSdlc.proxy.username`
- Key: `kiroSdlc.proxy.password`
