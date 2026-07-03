/**
 * WebModule — Internet/Network tools for Kiro Chatbox.
 * Provides: fetch_url, web_search, git_clone_browse, download_file, api_call, read_webpage.
 */

import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
import { loadWebConfig, type WebModuleConfig } from './models/WebModuleConfig.js';
import { SsrfGuard } from './middleware/SsrfGuard.js';
import { RateLimiter } from './middleware/RateLimiter.js';
import { ContentTruncator } from './middleware/ContentTruncator.js';
import { FetchUrlHandler } from './handlers/FetchUrlHandler.js';
import { WebSearchHandler } from './handlers/WebSearchHandler.js';
import { GitBrowseHandler } from './handlers/GitBrowseHandler.js';
import { DownloadFileHandler } from './handlers/DownloadFileHandler.js';
import { ApiCallHandler } from './handlers/ApiCallHandler.js';
import { ReadWebpageHandler } from './handlers/ReadWebpageHandler.js';
import { loadConfig } from '../../engine/config.js';

export class WebModule implements IModule {
  readonly name = 'web';
  private _status: ModuleStatus = 'initializing';
  private logger: Logger;
  private config!: WebModuleConfig;
  private fetchHandler!: FetchUrlHandler;
  private searchHandler!: WebSearchHandler;
  private gitHandler!: GitBrowseHandler;
  private downloadHandler!: DownloadFileHandler;
  private apiHandler!: ApiCallHandler;
  private webpageHandler!: ReadWebpageHandler;

  constructor(logger: Logger) { this.logger = logger.child({ module: this.name }); }
  get status(): ModuleStatus { return this._status; }

  async initialize(): Promise<void> {
    this.logger.info('Initializing web module');
    const appConfig = loadConfig();
    this.config = loadWebConfig(appConfig.workspace);
    const ssrf = new SsrfGuard(this.config.ssrfBlocklist);
    const rl = new RateLimiter(this.config.rateLimitRpm);
    const ct = new ContentTruncator(this.config.maxResponseKb);
    this.fetchHandler = new FetchUrlHandler(ssrf, rl, ct, this.config);
    this.searchHandler = new WebSearchHandler(rl, this.config);
    this.gitHandler = new GitBrowseHandler(rl, this.config);
    this.downloadHandler = new DownloadFileHandler(ssrf, rl, this.config);
    this.apiHandler = new ApiCallHandler(ssrf, rl, ct, this.config);
    this.webpageHandler = new ReadWebpageHandler(ssrf, rl, ct, this.config);
    this._status = 'ready';
    this.logger.info('Web module ready');
  }

  async shutdown(): Promise<void> {
    await this.webpageHandler?.shutdown();
    this._status = 'stopped';
  }

  getToolHandlers(): Map<string, ToolHandler> {
    const h = new Map<string, ToolHandler>();
    h.set('fetch_url', (args) => this.fetchHandler.handle(args));
    h.set('web_search', (args) => this.searchHandler.handle(args));
    h.set('git_clone_browse', (args) => this.gitHandler.handle(args));
    h.set('download_file', (args) => this.downloadHandler.handle(args));
    h.set('api_call', (args) => this.apiHandler.handle(args));
    h.set('read_webpage', (args) => this.webpageHandler.handle(args));
    return h;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      { name: 'fetch_url', description: 'Fetch content from a public URL', category: 'web', inputSchema: { type: 'object', properties: { url: { type: 'string' }, mode: { type: 'string', enum: ['full', 'truncated', 'selective'] }, max_length: { type: 'number' }, selector: { type: 'string' } }, required: ['url'] } },
      { name: 'web_search', description: 'Search the internet', category: 'web', inputSchema: { type: 'object', properties: { query: { type: 'string' }, num_results: { type: 'number' }, category: { type: 'string' }, language: { type: 'string' } }, required: ['query'] } },
      { name: 'git_clone_browse', description: 'Browse GitHub/GitLab repos via API', category: 'web', inputSchema: { type: 'object', properties: { repo_url: { type: 'string' }, operation: { type: 'string' }, path: { type: 'string' }, ref: { type: 'string' }, token: { type: 'string' } }, required: ['repo_url'] } },
      { name: 'download_file', description: 'Download file to workspace', category: 'web', inputSchema: { type: 'object', properties: { url: { type: 'string' }, dest_path: { type: 'string' }, overwrite: { type: 'boolean' } }, required: ['url'] } },
      { name: 'api_call', description: 'Make HTTP API calls', category: 'web', inputSchema: { type: 'object', properties: { url: { type: 'string' }, method: { type: 'string' }, headers: { type: 'object' }, body: {}, timeout: { type: 'number' } }, required: ['url'] } },
      { name: 'read_webpage', description: 'Render JS page and extract text', category: 'web', inputSchema: { type: 'object', properties: { url: { type: 'string' }, wait_for: { type: 'string' }, selector: { type: 'string' }, timeout: { type: 'number' }, block_resources: { type: 'array' } }, required: ['url'] } },
    ];
  }
}
