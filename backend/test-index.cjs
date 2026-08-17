const http = require('http');
function post(url, body, headers) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.write(data); req.end();
  });
}
async function run() {
  // Login
  const login = await post('http://127.0.0.1:48721/api/admin/auth/login', { username: 'admin', password: 'Admin@123456' });
  console.log('Login:', login.status);
  if (login.status !== 200) { console.log('Login failed:', login.body); return; }
  const token = JSON.parse(login.body).token;
  console.log('Token:', token.substring(0, 20) + '...');

  // Trigger full index
  const idx = await post('http://127.0.0.1:48721/api/index/full', {}, { 
    'Authorization': 'Bearer ' + token, 
    'X-Project-Id': 'SDLC-Agents-4-Enterprise',
    'X-Workspace-Root': 'c:\\projects\\kiro\\SDLC-Agents-4-Enterprise'
  });
  console.log('POST /api/index/full:', idx.status, idx.body.substring(0, 300));

  // Wait a bit then check progress
  await new Promise(r => setTimeout(r, 3000));
  const prog = await new Promise((resolve) => {
    const u = new URL('http://127.0.0.1:48721/api/index/progress');
    http.get({ hostname: u.hostname, port: u.port, path: u.pathname, headers: { 'Authorization': 'Bearer ' + token, 'X-Project-Id': 'SDLC-Agents-4-Enterprise' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
  console.log('GET /api/index/progress:', prog.status, prog.body.substring(0, 200));
}
run().catch(e => console.error(e.message));
