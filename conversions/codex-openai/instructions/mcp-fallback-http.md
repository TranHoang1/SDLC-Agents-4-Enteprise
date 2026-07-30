# MCP Fallback via HTTP

When MCP is disabled at org level, use `Invoke-RestMethod` / `curl` to call MCP server directly via HTTP (JSON-RPC 2.0).

## Get URL from config

```powershell
$mcpConfig = Get-Content ".kiro/settings/mcp.json" -Raw | ConvertFrom-Json
$baseUrl = $mcpConfig.mcpServers."code-intelligence".url
```

## Protocol: JSON-RPC 2.0 over HTTP

### General:
```powershell
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<TOOL>","arguments":{...}}}'
Invoke-RestMethod -Uri $baseUrl -Method POST -ContentType "application/json" -Body $body
```

### List all tools:
```powershell
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
Invoke-RestMethod -Uri $baseUrl -Method POST -ContentType "application/json" -Body $body
```

## Important

- ALWAYS read URL from config — do NOT hardcode port
- Check server running: `Invoke-WebRequest -Uri $baseUrl -Method HEAD`
- Response: `{"jsonrpc":"2.0","id":1,"result":{...}}`
- Error: `{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"..."}}`