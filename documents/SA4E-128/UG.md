# User Guide — AgentShield Security Scanner (SA4E-128)

## 1. Overview

AgentShield scans AI agent configuration files for security vulnerabilities. It detects hardcoded secrets, insecure HTTP endpoints, prompt injection vectors, overly permissive permissions, and disabled TLS validation.

## 2. Quick Start

Call the `agentshield_scan` MCP tool with a list of config file paths:

```json
{
  "name": "agentshield_scan",
  "arguments": {
    "paths": [".agents/mcp.json", ".kiro/settings/mcp.json"]
  }
}
```

## 3. Tool Reference

### agentshield_scan

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paths` | `string[]` | Yes | Relative file paths within workspace to scan |
| `rules` | `string[]` | No | Specific rule IDs to run. Omit to run all 5 rules |

### Response Format

```json
{
  "findings": [
    {
      "severity": "CRITICAL",
      "rule": "SHIELD-001",
      "file": ".agents/mcp.json",
      "line": 5,
      "message": "Hardcoded AWS Access Key ID detected"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 0,
    "medium": 0,
    "low": 0
  }
}
```

## 4. Scanning Rules

| Rule ID | Severity | What It Detects |
|---------|----------|-----------------|
| SHIELD-001 | CRITICAL | Hardcoded secrets: AWS keys (`AKIA...`), OpenAI keys (`sk-...`), GitHub tokens (`ghp_...`), Slack tokens, GitLab PATs, password fields with plaintext values |
| SHIELD-002 | HIGH | Non-TLS HTTP MCP server endpoints (exception: `localhost` and `127.0.0.1` are allowed) |
| SHIELD-003 | HIGH | Prompt injection vectors: `${...}` template literals, backtick commands, `eval()`/`Function()`/`exec()` calls |
| SHIELD-004 | MEDIUM | Overly permissive file permissions (777, 666, umask 000) in config values |
| SHIELD-005 | LOW | Disabled TLS validation: `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` |

## 5. Usage Examples

### Scan all agent configs

```json
{
  "paths": [".agents/mcp.json", ".kiro/settings/mcp.json", "mcp-config.json"]
}
```

### Run only secret detection

```json
{
  "paths": ["config/servers.json"],
  "rules": ["SHIELD-001"]
}
```

### Run multiple specific rules

```json
{
  "paths": ["mcp.json"],
  "rules": ["SHIELD-001", "SHIELD-002", "SHIELD-005"]
}
```

## 6. Path Safety

- All paths must be **relative** to the workspace root
- Path traversal attempts (`../../etc/passwd`) are rejected silently
- Absolute paths are rejected
- Non-existent files are skipped without error

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty findings for known-bad file | Path is invalid or outside workspace | Use relative path from workspace root |
| `Validation error` response | Invalid input format | Ensure `paths` is a non-empty string array |
| File not scanned | File does not exist at resolved path | Verify file exists at the relative path |
| No findings for a specific rule | Rule not in active set | Omit `rules` param to run all, or include the rule ID |

## 8. Error Codes

| Error | Meaning |
|-------|---------|
| `Validation error: At least one path required` | `paths` array is empty |
| `Validation error: ...` | Input doesn't match expected schema |
| `Path rejected by safety guard` (logged, not returned) | Path traversal or absolute path attempted |

## 9. Integration

AgentShield is part of the SecurityModule and starts automatically with the MCP server. No additional configuration needed. The tool is available alongside GateGuard tools (`gateguard_evaluate`, `gateguard_denylist`, `gateguard_audit_log`).
