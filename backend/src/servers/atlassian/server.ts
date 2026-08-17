/**
 * SA4E-110 - AtlassianServer class: creates McpServer, registers all 65 tools.
 * Orchestrates credential management, API clients, and tool registration.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CredentialManager } from './credentials/credential-manager.js';
import { RateLimiter } from './clients/rate-limiter.js';
import { JiraApiClient } from './clients/jira-client.js';
import { ConfluenceApiClient } from './clients/confluence-client.js';
import { createConfig, type ServerConfig } from './config.js';
import type { HttpClientConfig } from './models/types.js';
import { registerJiraIssueTools } from './tools/jira-issue-tools.js';
import { registerJiraSearchTools } from './tools/jira-search-tools.js';
import { registerJiraTransitionTools } from './tools/jira-transition-tools.js';
import { registerJiraCommentTools } from './tools/jira-comment-tools.js';
import { registerJiraAttachmentTools } from './tools/jira-attachment-tools.js';
import { registerJiraFieldTools } from './tools/jira-field-tools.js';
import { registerJiraProjectTools } from './tools/jira-project-tools.js';
import { registerJiraAgileTools } from './tools/jira-agile-tools.js';
import { registerJiraUserTools } from './tools/jira-user-tools.js';
import { registerJiraWorklogTools } from './tools/jira-worklog-tools.js';
import { registerConfluencePageTools } from './tools/confluence-page-tools.js';
import { registerConfluenceSearchTools } from './tools/confluence-search-tools.js';
import { registerConfluenceSpaceTools } from './tools/confluence-space-tools.js';
import { registerConfluenceContentTools } from './tools/confluence-content-tools.js';
import { registerConfluenceCommentTools } from './tools/confluence-comment-tools.js';

/**
 * Main Atlassian MCP Server class.
 * Creates McpServer instance, initializes clients, registers all tools.
 */
export class AtlassianServer {
  private mcpServer: McpServer;
  private credentialManager: CredentialManager;
  private rateLimiter: RateLimiter;
  private config: ServerConfig;

  constructor(configOverrides?: Partial<ServerConfig>) {
    this.config = createConfig(configOverrides);
    this.credentialManager = new CredentialManager();
    this.rateLimiter = new RateLimiter(
      this.config.rateLimiter.maxTokens,
      this.config.rateLimiter.refillIntervalMs,
    );
    this.mcpServer = new McpServer({
      name: this.config.server.name,
      version: this.config.server.version,
    });
  }

  /** Initialize credentials, create clients, register all 65 tools */
  async initialize(): Promise<void> {
    this.credentialManager.initialize();
    const clientConfig = await this.buildClientConfig();
    const jiraClient = new JiraApiClient(clientConfig);
    const confluenceClient = new ConfluenceApiClient(clientConfig);
    this.registerAllTools(jiraClient, confluenceClient);
  }

  /** Get the underlying McpServer for transport connection */
  getServer(): McpServer {
    return this.mcpServer;
  }

  /** Notify rate limiter of reconnect event (P5) */
  handleReconnect(): void {
    this.rateLimiter.setReconnectMode(true);
  }

  private async buildClientConfig(): Promise<HttpClientConfig> {
    const baseUrl = await this.credentialManager.getBaseUrl();
    return {
      baseUrl,
      authHeaders: () => this.credentialManager.getAuthHeaders(),
      rateLimiter: this.rateLimiter,
      timeouts: this.config.timeouts,
    };
  }

  private registerAllTools(jira: JiraApiClient, confluence: ConfluenceApiClient): void {
    // Jira tools (42 tools)
    registerJiraIssueTools(this.mcpServer, jira);
    registerJiraSearchTools(this.mcpServer, jira);
    registerJiraTransitionTools(this.mcpServer, jira);
    registerJiraCommentTools(this.mcpServer, jira);
    registerJiraAttachmentTools(this.mcpServer, jira);
    registerJiraFieldTools(this.mcpServer, jira);
    registerJiraProjectTools(this.mcpServer, jira);
    registerJiraAgileTools(this.mcpServer, jira);
    registerJiraUserTools(this.mcpServer, jira);
    registerJiraWorklogTools(this.mcpServer, jira);
    // Confluence tools (23 tools)
    registerConfluencePageTools(this.mcpServer, confluence);
    registerConfluenceSearchTools(this.mcpServer, confluence);
    registerConfluenceSpaceTools(this.mcpServer, confluence);
    registerConfluenceContentTools(this.mcpServer, confluence);
    registerConfluenceCommentTools(this.mcpServer, confluence);
  }
}