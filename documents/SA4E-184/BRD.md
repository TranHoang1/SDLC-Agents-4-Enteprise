# Business Requirements Document (BRD)

## SA4E-184 — WebModule: Internet/Network Tools

| Field | Value |
|-------|-------|
| Ticket | SA4E-184 |
| Type | Feature |
| Status | Retroactive Documentation |
| Priority | High |
| Created | 2025-01-27 |
| Related BRD | BRD-v1-SA4E-184.docx |

---

## 1. Executive Summary

WebModule extends the Code Intelligence MCP server with internet/network capabilities, enabling AI agents to search the web, fetch URLs, browse Git repositories, download files, make API calls, and render JavaScript-heavy pages. This module operates within the existing module architecture and exposes tools via the MCP protocol.

---

## 2. Business Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| OBJ-1 | Enable AI agents to retrieve information from the internet | Agents can successfully search and fetch web content |
| OBJ-2 | Provide secure, rate-limited web access | Zero SSRF vulnerabilities; rate limiting prevents abuse |
| OBJ-3 | Support browsing open-source repositories without cloning | Git repos browsable via API (GitHub/GitLab) |
| OBJ-4 | Allow controlled file downloads to workspace | Files downloaded with size/extension validation |
| OBJ-5 | Enable arbitrary HTTP API calls for integrations | Agents can call REST APIs with full method support |
| OBJ-6 | Support reading JavaScript-rendered pages | Playwright renders dynamic pages for extraction |

---

## 3. Stakeholders

| Role | Name/Team | Responsibility |
|------|-----------|---------------|
| Product Owner | Engineering Lead | Feature prioritization |
| Developer | Backend Team | Implementation |
| Security | Security Review | SSRF, rate limiting, input validation |
| Consumer | AI Agents (LangGraph) | End users of the tools |

---

## 4. User Stories

#### STORY-1: Web Search

**As an** AI agent,  
**I want to** search the internet for information,  
**So that** I can find relevant data to answer user questions.

**Acceptance Criteria:**
- AC-1.1: Search queries return structured results (title, URL, snippet)
- AC-1.2: Results come from SearXNG with DuckDuckGo fallback
- AC-1.3: Results are cached for 10 minutes to reduce external calls
- AC-1.4: Maximum 10 results per query
- AC-1.5: Category and language filtering supported
- AC-1.6: Rate limiting enforced (configurable RPM)

#### STORY-2: Fetch URL Content

**As an** AI agent,  
**I want to** fetch and extract text from web pages,  
**So that** I can read article content, documentation, and resources.

**Acceptance Criteria:**
- AC-2.1: Three modes: full (default), truncated, selective (CSS selector)
- AC-2.2: HTML stripped to plain text with structure preserved
- AC-2.3: Content truncated if exceeding configured max size
- AC-2.4: SSRF protection blocks internal/private IPs
- AC-2.5: Results cached 5 minutes per URL+mode combination
- AC-2.6: Page title extracted from HTML

#### STORY-3: Browse Git Repositories

**As an** AI agent,  
**I want to** browse GitHub/GitLab repositories via API,  
**So that** I can examine code structure and read files without cloning.

**Acceptance Criteria:**
- AC-3.1: Operations: readme, tree, read_file
- AC-3.2: GitHub and GitLab APIs supported
- AC-3.3: Repository URL parsed to extract host/owner/repo
- AC-3.4: Optional auth token for private repos
- AC-3.5: Optional ref (branch/tag/commit) targeting

#### STORY-4: Download Files

**As an** AI agent,  
**I want to** download files from the internet to the workspace,  
**So that** I can work with remote assets locally.

**Acceptance Criteria:**
- AC-4.1: Downloaded file saved to workspace (configurable dest_path)
- AC-4.2: Dangerous extensions blocked (.exe, .bat, .cmd, .ps1, .sh, .msi, .scr)
- AC-4.3: Maximum file size enforced (default 50MB)
- AC-4.4: Path traversal prevented (must stay within workspace)
- AC-4.5: SSRF protection applied

#### STORY-5: HTTP API Calls

**As an** AI agent,  
**I want to** make HTTP API requests to external services,  
**So that** I can integrate with third-party APIs.

**Acceptance Criteria:**
- AC-5.1: Methods: GET, POST, PUT, DELETE, PATCH
- AC-5.2: Custom headers and JSON/string body supported
- AC-5.3: Response includes status, headers, body, elapsed time
- AC-5.4: Timeout configurable (max 60s)
- AC-5.5: SSRF and rate limiting applied

#### STORY-6: Read JavaScript-Rendered Pages

**As an** AI agent,  
**I want to** read content from JavaScript-heavy pages,  
**So that** I can access SPAs and dynamic content.

**Acceptance Criteria:**
- AC-6.1: Playwright renders the page in headless Chrome
- AC-6.2: Wait strategies: networkidle, load, domcontentloaded, selector
- AC-6.3: CSS selector extraction supported
- AC-6.4: Resource blocking (images, fonts, media) to reduce load
- AC-6.5: Maximum concurrent browser contexts enforced
- AC-6.6: Browser gracefully shut down on module shutdown

---

## 5. Business Rules

| ID | Rule | Category |
|----|------|----------|
| BR-01 | All external URLs must pass SSRF validation before request | Security |
| BR-02 | Private/internal IPs (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7) are blocked | Security |
| BR-03 | All tools share a token-bucket rate limiter (per-tool buckets) | Performance |
| BR-04 | Default rate limit: 10 requests per minute per tool | Performance |
| BR-05 | Default timeout: 30 seconds per request | Performance |
| BR-06 | Response content truncated at configurable max KB (default 100KB) | Performance |
| BR-07 | Dangerous file extensions cannot be downloaded | Security |
| BR-08 | Downloaded files must remain within workspace boundary | Security |
| BR-09 | Only http: and https: protocols allowed | Security |
| BR-10 | Search results cached 10 min; fetch results cached 5 min | Performance |
| BR-11 | Maximum 3 concurrent browser contexts for read_webpage | Resource |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Tool response time | < 30s (configurable timeout) |
| NFR-02 | Security | SSRF protection | Zero internal IP access |
| NFR-03 | Security | DNS rebinding protection | Resolve before request |
| NFR-04 | Reliability | Graceful degradation | SearXNG fails → DuckDuckGo fallback |
| NFR-05 | Resource | Memory (cache) | Max 300 search + 200 fetch entries |
| NFR-06 | Resource | Browser contexts | Max 3 concurrent |
| NFR-07 | Configurability | All limits via env vars | WEB_* prefix |
| NFR-08 | Compatibility | Node.js 18+ | Uses native fetch, AbortSignal.timeout |

---

## 7. Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| SearXNG instance | External Service | Primary search engine |
| DuckDuckGo API | External Service | Fallback search |
| GitHub REST API | External Service | Git repo browsing |
| GitLab REST API | External Service | Git repo browsing |
| Playwright (chromium) | Library | JS page rendering |
| Node.js native fetch | Runtime | HTTP requests |

---

## 8. Assumptions & Constraints

| # | Type | Description |
|---|------|-------------|
| 1 | Assumption | SearXNG is deployed locally (localhost:8080 default) |
| 2 | Assumption | Playwright chromium is installed in the environment |
| 3 | Constraint | Module runs within MCP server process (shared event loop) |
| 4 | Constraint | No persistent storage — caches are in-memory only |
| 5 | Constraint | DNS resolution required before SSRF check (adds latency) |

---

## 9. Out of Scope

- Persistent web scraping / crawling
- Cookie/session management across requests
- Form submission
- File upload to remote servers
- Web page screenshots
- Proxy support

---

## Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
