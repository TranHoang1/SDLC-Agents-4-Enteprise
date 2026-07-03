/**
 * URL validation utility.
 * Ensures URLs are well-formed and use allowed protocols.
 */

import { WebToolError } from '../models/WebError.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function validateUrl(urlStr: string): URL {
  if (!urlStr || typeof urlStr !== 'string') {
    throw new WebToolError('INVALID_URL', 'URL cannot be empty');
  }
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new WebToolError('INVALID_URL', `Invalid URL format: ${urlStr}`);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new WebToolError('INVALID_URL', `Protocol not allowed: ${url.protocol}`);
  }
  return url;
}
