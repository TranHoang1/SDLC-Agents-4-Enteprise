// Usage: node test-find-tools.mjs [baseUrl] [query]
const baseUrl = process.argv[2] || 'http://localhost:48721/mcp';
const query = process.argv[3] || 'search issues';

async function main() {
  console.log(`Calling find_tools with query: "${query}"`);
  
  try {
    const res = await fetch(`${baseUrl}/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'find_tools',
        arguments: { query, top_k: 3 }
      })
    });
    
    if (!res.ok) {
      console.error('Error status:', res.status);
      console.error(await res.text());
      return;
    }
    
    const result = await res.json();
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

main();
