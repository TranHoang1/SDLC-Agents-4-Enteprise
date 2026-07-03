
const ws = new WebSocket('ws://localhost:3061/mcp');

ws.addEventListener('open', () => {
  console.log('WebSocket connected!');
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  }));
});

ws.addEventListener('message', (event) => {
  console.log('Received:', event.data.toString());
  ws.close();
});

ws.addEventListener('error', (event) => {
  console.log('WebSocket error:', event.message || event.type);
});

ws.addEventListener('close', (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
});
