// Usage: node get-jira.js [baseUrl] [issueKey]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
  const baseUrl = process.argv[2] || "http://localhost:3061/mcp";
  const issueKey = process.argv[3] || "KSA-292";
  console.log(`Fetching ${issueKey} from ${baseUrl}...`);
  
  const transport = new SSEClientTransport(new URL(`${baseUrl}?sessionId=test-session-${Date.now()}`));
  const client = new Client({ name: "cli", version: "1.0.0" }, { capabilities: {} });
  
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "jira_get_issue",
      arguments: { issue_key: issueKey }
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await transport.close();
  }
}

main();
