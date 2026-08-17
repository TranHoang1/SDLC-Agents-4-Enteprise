/**
 * Unit tests for PkceService — PKCE verifier/challenge generation (S256).
 */

import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import { PkceService } from "../PkceService";

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const BASE64URL_CHARSET = /^[A-Za-z0-9_-]+$/;

describe("PkceService", () => {
  const service = new PkceService();

  it("generates a code verifier of the expected length", () => {
    const verifier = service.generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it("generates a verifier using only base64url characters", () => {
    for (let i = 0; i < 50; i++) {
      const verifier = service.generateCodeVerifier();
      expect(verifier).toMatch(BASE64URL_CHARSET);
    }
  });

  it("generates distinct verifiers across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const verifier = service.generateCodeVerifier();
      expect(seen.has(verifier)).toBe(false);
      seen.add(verifier);
    }
  });

  it("derives the same S256 challenge as node crypto for a known verifier", () => {
    const verifier = "known-verifier-value";
    const expected = base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
    expect(service.generateCodeChallenge(verifier)).toBe(expected);
  });

  it("generates a 43-char challenge in the base64url charset", () => {
    for (let i = 0; i < 20; i++) {
      const verifier = service.generateCodeVerifier();
      const challenge = service.generateCodeChallenge(verifier);
      expect(challenge).toMatch(BASE64URL_CHARSET);
      expect(challenge.length).toBe(43);
      expect(challenge.endsWith("=")).toBe(false);
    }
  });

  it("is deterministic for the same verifier", () => {
    const verifier = service.generateCodeVerifier();
    expect(service.generateCodeChallenge(verifier)).toBe(service.generateCodeChallenge(verifier));
  });

  it("produces different challenges for different verifiers", () => {
    const v1 = service.generateCodeVerifier();
    const v2 = service.generateCodeVerifier();
    expect(service.generateCodeChallenge(v1)).not.toBe(service.generateCodeChallenge(v2));
  });
});