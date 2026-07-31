# User Guide — SA4E-PROXY: Proxy Configuration

## 1. Overview

The Proxy Configuration page allows you to route all extension HTTP traffic through a corporate proxy server. This is essential for enterprise environments where direct internet access is restricted.

## 2. Accessing Proxy Settings

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run **SDLC Agents: Settings**
3. Click the **🔒 Proxy** tab

## 3. Proxy Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **No Proxy** | Direct connection — bypasses all proxy settings | Home networks, unrestricted environments |
| **System Proxy** (default) | Auto-detects proxy from environment variables and VS Code `http.proxy` | Most corporate setups where env vars are pre-configured |
| **Manual** | User-specified proxy host and port | When env vars are not set or you need a different proxy |

### System Proxy Detection Priority

When "System Proxy" mode is active, the extension detects proxy settings in this order:

1. `HTTPS_PROXY` / `https_proxy` environment variable
2. `HTTP_PROXY` / `http_proxy` environment variable
3. VS Code built-in `http.proxy` setting

## 4. Manual Configuration

When you select **Manual** mode, configure:

| Field | Description | Example |
|-------|-------------|---------|
| **Proxy Host** | Hostname or IP of the proxy server | `proxy.company.com` |
| **Port** | Proxy server port (1–65535) | `8080` |
| **Bypass List** | Comma-separated hosts that skip the proxy | `localhost,127.0.0.1,*.internal.com` |

### Bypass List Wildcards

- `*.domain.com` — matches any subdomain (e.g., `api.domain.com`)
- `.domain.com` — same as `*.domain.com`
- `localhost` — exact match

### URL Preview

As you type host and port, a live preview shows the resulting proxy URL:
```
Proxy URL: http://proxy.company.com:8080
```

## 5. Proxy Authentication

If your proxy requires authentication:

1. Enter **Username** and **Password** in the Authentication section
2. Click **Save Credentials**
3. Credentials are stored securely in VS Code SecretStorage (never in settings.json)

To remove saved credentials, click **Clear Credentials**.

## 6. Testing Connectivity

Click **Test Proxy** to verify the proxy works. The test:
- Uses current (unsaved) form values
- Sends a request to `https://httpbin.org/get` through the proxy
- Reports success/failure with latency

Click **Detect System Proxy** to see what environment proxy is currently configured.

## 7. Configuration Reference

### VS Code Settings (`settings.json`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kiroSdlc.proxy.mode` | `"none" \| "system" \| "manual"` | `"system"` | Proxy operating mode |
| `kiroSdlc.proxy.host` | `string` | `""` | Proxy hostname (manual mode) |
| `kiroSdlc.proxy.port` | `number` | `8080` | Proxy port (manual mode) |
| `kiroSdlc.proxy.bypass` | `string` | `"localhost,127.0.0.1,::1"` | Bypass list |

### SecretStorage Keys (not visible in settings.json)

| Key | Purpose |
|-----|---------|
| `kiroSdlc.proxy.username` | Proxy auth username |
| `kiroSdlc.proxy.password` | Proxy auth password |

## 8. Behavior Notes

- **Immediate effect**: Changing proxy mode or saving config applies immediately — no extension restart needed
- **Graceful fallback**: If proxy is misconfigured, requests fall back to direct connection
- **Scope**: Proxy settings are **Global** (machine-specific), not workspace-specific
- **All traffic routed**: GET, POST, streaming, and health check requests all go through the proxy

## 9. Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Connection refused" | Wrong host/port | Verify proxy address with IT |
| "Cannot resolve proxy hostname" | DNS issue | Try IP address instead of hostname |
| "Connection timed out" | Proxy unreachable or firewall | Check network connectivity |
| "Proxy requires authentication" (407) | Missing or wrong credentials | Enter credentials in Auth section |
| "SSL error" | Corporate SSL inspection | Configure system certificates |
| Extension works but proxy test fails | Bypass list includes test target | This is expected — bypass is working |

## 10. Error Codes

| Error | Meaning |
|-------|---------|
| `ECONNREFUSED` | Proxy server actively refused connection |
| `ENOTFOUND` | Proxy hostname could not be resolved |
| `UND_ERR_CONNECT_TIMEOUT` | Connection to proxy timed out (10s) |
| `ERR_TLS_*` | SSL/TLS handshake failure |
| HTTP 407 | Proxy Authentication Required |

## 11. FAQ

**Q: Does the proxy affect VS Code's built-in proxy?**
A: No. This proxy setting only affects the SDLC Agents extension's outbound traffic. VS Code's own `http.proxy` setting is independent (though we read it in System mode).

**Q: Can I use different proxies for different workspaces?**
A: No. Proxy is a Global (machine-level) setting because it represents network infrastructure, not project configuration.

**Q: Where are my credentials stored?**
A: In VS Code's SecretStorage — the same secure mechanism used for API keys. They are never written to settings.json or any file on disk.

**Q: What if I'm behind a proxy that does SSL inspection?**
A: You may need to configure Node.js to trust your corporate CA certificate. Set the `NODE_EXTRA_CA_CERTS` environment variable to point to your CA bundle.
