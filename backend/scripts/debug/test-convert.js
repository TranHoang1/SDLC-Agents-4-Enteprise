import http from 'http';

// Usage: node test-convert.js [baseUrl]
const baseUrl = process.argv[2] || 'http://localhost:48721/mcp';

const payload = JSON.stringify({
  tool_name: 'execute_dynamic_tool',
  arguments: {
    toolName: 'convert_to_markdown',
    arguments: {
      uri: 'file:///C:/projects/kiro/FEC_CR_Builder/documents/KSA-14/STC-v1-KSA-14.xlsx'
    }
  }
});

const req = http.request(`${baseUrl}/tools/call`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', (err) => console.error(err));
req.write(payload);
req.end();
