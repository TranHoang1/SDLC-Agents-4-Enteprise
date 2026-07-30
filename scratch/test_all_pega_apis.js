const user = 'SSA@TGB';
const pass = 'pega123!';
const baseApiUrl = 'https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1';
const authHeader = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');

async function testApi(name, url, method, body = null) {
  console.log(`\n==================================================`);
  console.log(`[TESTING] ${name}`);
  console.log(`Method: ${method} | URL: ${url}`);
  try {
    const options = {
      method: method,
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = typeof body === 'object' ? JSON.stringify(body) : body;
      console.log(`Request Body:`, options.body);
    }

    const res = await fetch(url, options);
    const text = await res.text();
    console.log(`HTTP Status Code: ${res.status}`);
    console.log(`Response Length: ${text.length} bytes`);
    console.log(`Response Output:\n${text.substring(0, 1500)}`);
  } catch (e) {
    console.log(`Error testing ${name}:`, e.message);
  }
}

(async () => {
  // Service 7: GET /rules/meta/{TargetClassName}
  await testApi("7. Unified Get Rule Metadata (Rule-Obj-Activity)", `${baseApiUrl}/rules/meta/Rule-Obj-Activity`, "GET");
  await testApi("7b. Unified Get Rule Metadata (TGB-HRApps-Work)", `${baseApiUrl}/rules/meta/TGB-HRApps-Work`, "GET");
})();
