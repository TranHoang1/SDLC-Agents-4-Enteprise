# User Guide — SA4E-110: Atlassian Credential Configuration

## Overview

The Atlassian Connection settings allow you to configure Jira/Confluence credentials for the Atlassian MCP child server. Credentials are stored securely in VS Code SecretStorage and provided to the child server via IPC on demand.

## Quick Start

1. Open **SDLC Pipeline Settings** (command palette → `SDLC: Open Settings`)
2. Navigate to the **Server Settings** tab
3. Scroll to **Atlassian Connection** section
4. Enter your Jira Base URL, email, and API token
5. Click **Save**, then **Test Connection**

## Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Jira Base URL | Your Atlassian instance root URL | `https://company.atlassian.net` |
| Email | Account email (Cloud) or username (Server/DC) | `user@company.com` |
| API Token / PAT | API token for Cloud, or Personal Access Token for Server | `ATATT3x...` |
| Connection Type | Cloud (email + API token) or Server/DC (username + PAT) | Cloud |

## Generating an API Token

### Atlassian Cloud
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Give it a label (e.g., "SA4E Extension")
4. Copy the token and paste into the **API Token** field

### Jira Server / Data Center
1. Go to your profile → Personal Access Tokens
2. Click **Create token**
3. Set expiry and permissions
4. Copy the PAT and paste into the **API Token / PAT** field
5. Select **Server/DC** connection type

## SecretStorage Keys

Credentials are persisted using VS Code's SecretStorage API:

| Key | Content |
|-----|---------|
| `kiroSdlc.atlassian.baseUrl` | Jira instance URL |
| `kiroSdlc.atlassian.email` | Email / username |
| `kiroSdlc.atlassian.apiToken` | API token (encrypted) |

## IPC Protocol

When the Atlassian child server needs credentials, it sends:
```json
{ "type": "getCredentials", "requestId": "<uuid>", "timestamp": 1234567890 }
```

The extension responds with:
```json
{
  "type": "credentials",
  "requestId": "<uuid>",
  "timestamp": 1234567890,
  "credentials": {
    "email": "user@company.com",
    "apiToken": "...",
    "baseUrl": "https://company.atlassian.net"
  }
}
```

## Test Connection

The **Test Connection** button sends `GET /rest/api/2/myself` with Basic authentication. A successful response displays the authenticated user's display name.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No credentials configured" | Fields not saved | Fill all fields and click Save |
| "Authentication failed (401)" | Wrong email or expired token | Regenerate API token |
| "Connection failed: fetch failed" | Network unreachable or wrong URL | Verify URL is correct and reachable |
| "Invalid Jira Base URL format" | URL missing protocol | Include `https://` prefix |
| Child server timeout | Extension credentials not saved | Save credentials in Settings panel |

## Error Codes

| Code | Description |
|------|-------------|
| 401 | Invalid email/token combination |
| 403 | Token lacks required permissions |
| 404 | Base URL incorrect (no Jira at that path) |
| ECONNREFUSED | Server unreachable |
| ETIMEDOUT | Request timed out (8s limit) |
