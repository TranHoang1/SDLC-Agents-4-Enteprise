/**
 * SA4E-182 — Secret Filter (SEC-01, SEC-02).
 * Deterministic regex-based pre/post filter for sensitive data.
 * Applied before sending to LLM and after receiving summary output.
 */

/** Patterns that match common secret formats */
const SECRET_PATTERNS: RegExp[] = [
  // API keys: sk-, pk-, api_, bearer tokens
  /\b(sk|pk|api)[_-][a-zA-Z0-9]{20,}\b/g,
  // AWS access keys
  /\bAKIA[0-9A-Z]{16}\b/g,
  // PEM private keys
  /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
  // Generic long hex/base64 tokens near "key", "token", "secret"
  /(?:key|token|secret|password|credential)[\s:=]+['"]?[a-zA-Z0-9+/=]{32,}['"]?/gi,
  // Environment variable exports with sensitive names
  /export\s+(?:API_KEY|SECRET|TOKEN|PASSWORD|DB_PASS|AUTH_TOKEN|PRIVATE_KEY)\s*=\s*.+/gi,
  // Connection strings with passwords
  /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@[^\s]+/gi,
  // GitHub/GitLab tokens
  /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g,
  // npm tokens
  /\bnpm_[a-zA-Z0-9]{36,}\b/g,
];

/** Replacement placeholder for redacted content */
const REDACTED = '[REDACTED]';

/**
 * Scan text and redact content matching known secret patterns.
 * @param text - Input text to filter
 * @returns Filtered text with secrets replaced by [REDACTED]
 */
export function filterSecrets(text: string): string {
  let filtered = text;
  for (const pattern of SECRET_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    filtered = filtered.replace(pattern, REDACTED);
  }
  return filtered;
}

/**
 * Check if text contains any secret patterns.
 * @param text - Text to check
 * @returns true if secrets detected
 */
export function containsSecrets(text: string): boolean {
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}
