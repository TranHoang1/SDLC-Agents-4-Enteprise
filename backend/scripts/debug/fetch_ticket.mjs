// Usage: node fetch_ticket.mjs [baseUrl] [issueKey]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function fetchTicket() {
  const baseUrl = process.argv[2] || 'http://localhost:3061/mcp';
  const issueKey = process.argv[3] || 'KSA-293';
  const transport = new SSEClientTransport(new URL(`${baseUrl}?sessionId=test-${Date.now()}`));
  const client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
  await client.connect(transport);
  const result = await client.callTool({
    name: 'jira_get_issue',
    arguments: { issue_key: issueKey }
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
fetchTicket().catch(console.error);
