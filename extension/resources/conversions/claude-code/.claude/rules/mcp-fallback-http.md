# MCP Fallback via HTTP

When MCP is disabled at org level, use `Invoke-RestMethod` to call MCP server directly via HTTP.

## Get URL from config

```powershell
$mcpConfig = Get-Content ".kiro/settings/mcp.json" -Raw | ConvertFrom-Json
$baseUrl = $mcpConfig.mcpServers."code-intelligence".url
```

## Protocol: JSON-RPC 2.0 over HTTP

### General format:
```powershell
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<TOOL>","arguments":{...}}}'
Invoke-RestMethod -Uri $baseUrl -Method POST -ContentType "application/json" -Body $body
```

### Common tools via HTTP:

| Tool | Purpose |
|---|---|
| `mem_ingest` | Store knowledge |
| `mem_search` | Search memory |
| `mem_ingest_file` | Ingest file |
| `find_tools` | Discover tools |
| `execute_dynamic_tool` | Execute dynamic tool |
| `code_search` | Search code |
| `stream_write_file` | Write large files |
| `drawio_export_png` | Export drawio to PNG |

### List all tools:
```powershell
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
Invoke-RestMethod -Uri $baseUrl -Method POST -ContentType "application/json" -Body $body
```

## Important

- ALWAYS read URL from config — do NOT hardcode port
- Check server is running: `Invoke-WebRequest -Uri $baseUrl -Method HEAD`
- Response: `{"jsonrpc":"2.0","id":1,"result":{...}}`
- Error: `{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"..."}}`