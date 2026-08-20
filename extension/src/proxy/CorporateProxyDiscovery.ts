/**
 * CorporateProxyDiscovery — Detect corporate proxy servers (McAfee/Skyhigh Web Gateway)
 * via DNS resolution and TCP port probing. Pure Node.js, no PowerShell dependency.
 *
 * SA4E-81 — Fallback detection when standard methods (env vars, registry, .NET) fail.
 * Covers transparent/inline proxies injected by McAfee Web Gateway Agent.
 */

import * as dns from "dns";
import * as net from "net";

/** Discovery result */
export interface DiscoveredProxy {
  url: string;
  hostname: string;
  ip: string;
  port: number;
  method: string;
}

/** Well-known corporate proxy hostnames to probe via DNS */
const PROXY_HOSTNAMES = [
  "cf-mwg-5", "cf-mwg-4", "cf-mwg-3", "cf-mwg-2", "cf-mwg-1",
  "mwg", "webgateway", "proxy", "web-proxy", "squid",
];

/** Common proxy ports ordered by likelihood */
const PROXY_PORTS = [9090, 9480, 8080, 3128, 8443];

/** TCP connect timeout per probe (ms) */
const PROBE_TIMEOUT_MS = 2000;

/**
 * Discover corporate proxy servers by resolving known hostnames
 * and probing common proxy ports. Returns first successful match.
 */
export async function discoverCorporateProxy(): Promise<DiscoveredProxy | null> {
  for (const hostname of PROXY_HOSTNAMES) {
    const ip = await resolveHostname(hostname);
    if (!ip) { continue; }

    for (const port of PROXY_PORTS) {
      const open = await probePort(ip, port);
      if (open) {
        return {
          url: `http://${ip}:${port}`,
          hostname,
          ip,
          port,
          method: "dns-probe",
        };
      }
    }
  }
  return null;
}

/**
 * Resolve hostname via OS DNS (getaddrinfo). Returns first IPv4 address or null.
 * Uses dns.lookup (OS resolver) — works in corporate environments where
 * dns.resolve4 (libuv resolver) may be blocked.
 */
function resolveHostname(hostname: string): Promise<string | null> {
  return new Promise((resolve) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err || !address) {
        resolve(null);
      } else {
        resolve(address);
      }
    });
  });
}

/**
 * TCP connect probe — checks if port is open within timeout.
 * Non-blocking, fast failure on closed ports.
 */
function probePort(ip: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (result: boolean) => {
      if (settled) { return; }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, ip);
  });
}
