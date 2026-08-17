/**
 * SA4E-110 - Entry point for the Atlassian MCP child server.
 * Boots with stdio transport, listens for IPC credential messages.
 * P1: Uses stdio transport (not httpStream) for security.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AtlassianServer } from './server.js';

/**
 * Boot the Atlassian MCP child server.
 * Connects via stdio transport to the orchestrator parent process.
 */
async function main(): Promise<void> {
  const server = new AtlassianServer();
  await server.initialize();

  const transport = new StdioServerTransport();
  const mcpServer = server.getServer();
  await mcpServer.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  // Handle reconnect signal from orchestrator
  process.on('message', (msg: unknown) => {
    if (msg && typeof msg === 'object' && 'type' in msg) {
      const typed = msg as { type: string };
      if (typed.type === 'reconnect') {
        server.handleReconnect();
      }
    }
  });
}

main().catch((err) => {
  process.stderr.write(`Atlassian server fatal: ${err}\n`);
  process.exit(1);
});