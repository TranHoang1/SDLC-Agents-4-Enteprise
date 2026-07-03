// Usage: node read-ksa-295.mjs [baseUrl]
const baseUrl = process.argv[2] || 'http://127.0.0.1:48721/mcp';

async function main() {
  try {
    const res = await fetch(`${baseUrl}/tools/list`, {
      method: 'GET',
    });
    const result = await res.json();
    console.log(JSON.stringify(result.tools.map(t => t.name), null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
main();
