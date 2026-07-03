/**
 * Handler for git_clone_browse tool.
 * Browses GitHub/GitLab repos via REST API.
 */

import type { ToolResult } from '../../../types/tool.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { parseGitUrl } from '../utils/GitUrlParser.js';
import { WebToolError } from '../models/WebError.js';
import { successResult, errorResult } from '../models/WebToolResult.js';

export class GitBrowseHandler {
  constructor(private rateLimiter: RateLimiter, private config: WebModuleConfig) {}

  async handle(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const repoUrl = args.repo_url as string;
      const operation = (args.operation as string) || 'readme';
      const filePath = args.path as string | undefined;
      const ref = (args.ref as string) || 'HEAD';
      const token = args.token as string | undefined;
      this.rateLimiter.consumeOrThrow('git_clone_browse');
      const parsed = parseGitUrl(repoUrl);
      const headers: Record<string, string> = { 'User-Agent': this.config.userAgent };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (parsed.host === 'github.com') {
        return await this.github(parsed.owner, parsed.repo, operation, filePath, ref, headers);
      }
      return await this.gitlab(parsed.owner, parsed.repo, operation, filePath, ref, headers);
    } catch (err) {
      if (err instanceof WebToolError) return errorResult(err);
      return errorResult(new WebToolError('TIMEOUT', (err as Error).message));
    }
  }

  private async github(owner: string, repo: string, op: string, path?: string, ref?: string, headers?: Record<string, string>): Promise<ToolResult> {
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const url = op === 'tree' ? `${base}/git/trees/${ref}?recursive=1`
      : op === 'read_file' ? `${base}/contents/${path}?ref=${ref}` : `${base}/readme`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(this.config.timeoutMs) });
    if (res.status === 404) throw new WebToolError('DNS_FAILED', 'Repository or file not found');
    if (!res.ok) throw new WebToolError('TIMEOUT', `GitHub API error: ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return successResult(this.formatGH(op, data, owner, repo, ref));
  }

  private async gitlab(owner: string, repo: string, op: string, path?: string, ref?: string, headers?: Record<string, string>): Promise<ToolResult> {
    const pid = encodeURIComponent(`${owner}/${repo}`);
    const base = `https://gitlab.com/api/v4/projects/${pid}/repository`;
    const url = op === 'tree' ? `${base}/tree?recursive=true&ref=${ref}`
      : op === 'read_file' ? `${base}/files/${encodeURIComponent(path || '')}/raw?ref=${ref}`
      : `${base}/files/README.md/raw?ref=${ref || 'main'}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(this.config.timeoutMs) });
    if (res.status === 404) throw new WebToolError('DNS_FAILED', 'Not found');
    if (!res.ok) throw new WebToolError('TIMEOUT', `GitLab error: ${res.status}`);
    const content = op === 'tree' ? await res.json() : await res.text();
    return successResult({ content, repo: `${owner}/${repo}`, ref });
  }

  private formatGH(op: string, data: Record<string, unknown>, owner: string, repo: string, ref?: string): unknown {
    if (op === 'tree') {
      const tree = (data.tree as Array<{ path: string; type: string; size?: number }>) || [];
      return { tree: tree.map(f => ({ path: f.path, type: f.type, size: f.size })), repo: `${owner}/${repo}`, ref, total_files: tree.length };
    }
    const content = data.encoding === 'base64' ? Buffer.from(data.content as string, 'base64').toString() : data.content;
    return { content, path: data.path, size: data.size, encoding: 'utf-8' };
  }
}
