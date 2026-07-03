// Usage: node sm-discovery.mjs [baseUrl] [query]
const baseUrl = process.argv[2] || 'http://localhost:48721/mcp';
const query = process.argv[3] || 'search issues';

async function discover(query) {
  const res = await fetch(`${baseUrl}/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool_name: 'find_tools',
      arguments: { query, top_k: 5, threshold: 0.4 }
    })
  });
  const data = await res.json();
  if (data.isError) return [];
  const parsed = JSON.parse(data.content[0].text);
  return parsed.tools.map(t => t.name);
}

async function main() {
  const queries = [
    process.argv[3] || "get issue details from project tracker",
    "search knowledge base semantic",
    "convert markdown to docx word document"
  ];
  
  for (const q of queries) {
    const tools = await discover(q);
    console.log(`Query: "${q}" ->`, tools);
  }
}

main().catch(console.error);
