/**
 * SSRF (Server-Side Request Forgery) protection middleware.
 * Validates URLs against blocklisted IP ranges and protocols.
 */

import { WebToolError } from '../models/WebError.js';
import * as dns from 'dns/promises';
import * as net from 'net';

export class SsrfGuard {
  private blocklist: string[];
  private allowedProtocols = new Set(['http:', 'https:']);

  constructor(blocklist: string[]) {
    this.blocklist = blocklist;
  }

  async validate(urlStr: string): Promise<string> {
    const url = this.parseUrl(urlStr);
    this.checkProtocol(url);
    const ip = await this.resolveHost(url.hostname);
    this.checkIp(ip);
    return ip;
  }

  isBlocked(ip: string): boolean {
    return this.isPrivateIp(ip);
  }

  private parseUrl(urlStr: string): URL {
    try { return new URL(urlStr); }
    catch { throw new WebToolError('INVALID_URL', `Invalid URL: ${urlStr}`); }
  }

  private checkProtocol(url: URL): void {
    if (!this.allowedProtocols.has(url.protocol)) {
      throw new WebToolError('INVALID_URL', `Protocol not allowed: ${url.protocol}`);
    }
  }

  private async resolveHost(hostname: string): Promise<string> {
    if (net.isIP(hostname)) return hostname;
    try {
      const addrs = await dns.resolve4(hostname);
      if (!addrs.length) throw new WebToolError('DNS_FAILED', `No addresses: ${hostname}`);
      return addrs[0];
    } catch (err) {
      if (err instanceof WebToolError) throw err;
      throw new WebToolError('DNS_FAILED', `Cannot resolve: ${hostname}`);
    }
  }

  private checkIp(ip: string): void {
    if (this.isPrivateIp(ip)) {
      throw new WebToolError('SSRF_BLOCKED', `Blocked internal IP: ${ip}`, { ip });
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (net.isIPv6(ip)) return this.isPrivateIpv6(ip);
    return this.isPrivateIpv4(ip);
  }

  private isPrivateIpv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }

  private isPrivateIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80')) return true;
    return false;
  }
}
