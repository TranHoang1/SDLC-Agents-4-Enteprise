import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Usage: node test-mcp-sdk.js [baseUrl]
const baseUrl = process.argv[2] || 'http://localhost:48721/mcp';

async function main() {
  console.log('Connecting to', baseUrl);
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
  const client = new Client({ name: 'code-intel-orchestrator', version: '1.0.0' }, { capabilities: {} });
  
  try {
    await client.connect(transport);
    console.log('Connected!');
    
    const toolsResult = await client.listTools();
    console.log('Tools:', toolsResult.tools.map(t => t.name));
    
    await client.close();
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
    }
  }
}

main();
