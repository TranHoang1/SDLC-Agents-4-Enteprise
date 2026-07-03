// Test the backend MCP streaming endpoint via HTTP (SSE/streamable HTTP).
// The backend exposes /mcp as a streamable HTTP endpoint, not WebSocket.
//
// Usage:
//   node test-stream.mjs [baseUrl]
//   node test-stream.mjs http://localhost:48721/mcp

const baseUrl = process.argv[2] || 'http://localhost:48721/mcp';

async function main() {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-stream', version: '1.0' }
    }
  });

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: payload
  });

  console.log(`Status: ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  console.log(`Content-Type: ${contentType}`);

  if (contentType.includes('text/event-stream')) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (line.startsWith('data:')) {
          console.log('EVENT:', line.slice(5).trim());
        }
      }
    }
  } else {
    const body = await res.text();
    console.log('Body:', body);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
