/**
 * Stub for @vscode/windows-ca-certs — a native (N-API) optional module.
 *
 * We never request system CA certificates (addCertificatesV1/V2 are false in
 * VscodeProxyResolverService), so this code path is never exercised. The stub
 * exists purely so the bundler can resolve the dynamic require inside
 * @vscode/proxy-agent's readWindowsCaCertificates() and keep the extension
 * self-contained (no runtime install required by users).
 */

export class Crypt32 {
  next(): unknown {
    return null;
  }
  done(): void {
    // no-op
  }
}
