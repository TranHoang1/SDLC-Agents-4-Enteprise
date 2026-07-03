import http from 'http';

// Usage: node test-atlassian-endpoints.js [baseUrl]
const baseUrl = process.argv[2] || 'http://localhost:3061/mcp';

const endpoints = [
  `${baseUrl}?sessionId=test`
];

async function checkEndpoint(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ url, status: res.statusCode, contentType: res.headers['content-type'], body: data });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message });
    });
  });
}

async function main() {
  console.log('Testing Atlassian endpoints...');
  for (const url of endpoints) {
    const result = await checkEndpoint(url);
    console.log(JSON.stringify(result));
  }
}

main();
