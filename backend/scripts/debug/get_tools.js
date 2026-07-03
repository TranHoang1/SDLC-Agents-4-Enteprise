// Usage: node get-tools.js [baseUrl]
const baseUrl = process.argv[2] || 'http://127.0.0.1:48721/mcp';

async function check() {
  try {
    const r = await fetch(`${baseUrl}/tools/list`);
    const d = await r.json();
    console.log("Total tools:", d.tools.length);
    console.log("List:", d.tools.map(t=>t.name).join(', '));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
check();
