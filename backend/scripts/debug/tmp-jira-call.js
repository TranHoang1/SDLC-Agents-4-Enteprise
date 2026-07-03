const http = require('http');

// Usage: node tmp-jira-call.js [baseUrl]
const baseUrl = process.argv[2] || 'http://localhost:3059/mcp';

function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(baseUrl);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => { resolve(responseData); });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const initRes = await makeRequest({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"sm",version:"1.0"}}});
  console.log("INIT:", initRes);
  
  const listRes = await makeRequest({jsonrpc:"2.0",id:2,method:"tools/list",params:{}});
  console.log("LIST:", listRes);
}
main().catch(console.error);
