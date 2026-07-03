/**
 * Git URL parser for GitHub/GitLab repositories.
 * Extracts host, owner, repo, optional path and ref from URLs.
 */

import { WebToolError } from '../models/WebError.js';

export interface ParsedGitUrl {
  host: string;
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
}

const SUPPORTED_HOSTS = new Set(['github.com', 'gitlab.com']);

export function parseGitUrl(urlStr: string): ParsedGitUrl {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new WebToolError('INVALID_URL', `Cannot parse repository URL: ${urlStr}`);
  }

  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new WebToolError('INVALID_URL', `Unsupported git host: ${url.hostname}`);
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new WebToolError('INVALID_URL', `Cannot parse owner/repo from: ${urlStr}`);
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  let path: string | undefined;
  let ref: string | undefined;

  if (parts.length > 3 && (parts[2] === 'blob' || parts[2] === 'tree')) {
    ref = parts[3];
    path = parts.slice(4).join('/') || undefined;
  }

  return { host: url.hostname, owner, repo, path, ref };
}
