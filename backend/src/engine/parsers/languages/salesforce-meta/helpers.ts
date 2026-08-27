/** SA4E-223 — regex/generic XML helpers for the salesforce-meta parser. */

/**
 * Secret element denylist (F-03): never index symbols whose name matches a
 * sensitive element such as <password> / <loginUrl>. Applied as a safety net in
 * SalesforceMetaParser.parse() so sensitive metadata values are not exposed.
 */
export const SECRET_ELEMENT_NAMES = new Set([
  'password', 'loginurl', 'secret', 'clientsecret', 'accesstoken', 'clientsecretortoken',
]);

export function isSecretElement(name: string | undefined | null): boolean {
  if (!name) return false;
  return SECRET_ELEMENT_NAMES.has(name.trim().toLowerCase());
}

/**
 * F-03 — Redact the *values* of secret elements so they never reach the index.
 *
 * The symbol-name denylist (`isSecretElement`) already prevents secret element
 * *names* (e.g. `<password>`) from being stored as symbols. This function is the
 * complementary defense-in-depth: it scrubs the *content* between secret tags
 * (e.g. `<password>secret123</password>` → `<password>[REDACTED]</password>`)
 * before any body/source is persisted (extractAndStoreBodies).
 */
export function scrubSecretValues(source: string): string {
  let out = source;
  for (const name of SECRET_ELEMENT_NAMES) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'gi');
    out = out.replace(re, `<${name}>[REDACTED]</${name}>`);
  }
  return out;
}

export function extractXmlValues(source: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'g');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    results.push(match[1]);
  }
  return results;
}

export function extractXmlBlocks(source: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}>[\\s\\S]*?</${tagName}>`, 'g');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    results.push(match[0]);
  }
  return results;
}

/** Strip all known `*-meta.xml` suffixes, then any simple extension. SA4E-223: 17 suffixes. */
export function nameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop() ?? normalized;
  return basename
    .replace(/\.(flow|object|field|js|component|flexipage|permissionset|profile|labels|tab|layout|report|dashboard|site|resource|email|testsuite)-meta\.xml$/i, '')
    .replace(/\.\w+$/, '');
}

export function inferObjectFromFieldPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/objects\/([^/]+)\/fields\//);
  return match ? match[1] : null;
}
