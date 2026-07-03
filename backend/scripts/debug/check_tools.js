// Usage: node check_tools.js [baseUrl]
const baseUrl = process.argv[2] || 'http://127.0.0.1:48721/mcp';

const reqUrl = baseUrl;

http.get(reqUrl, {
    headers: { 'Accept': 'text/event-stream' }
}, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
        buffer += chunk.toString();
        
        const lines = buffer.split('\n');
        let endpoint = null;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('event: endpoint') && lines[i+1] && lines[i+1].startsWith('data: ')) {
                endpoint = lines[i+1].substring(6).trim();
                break;
            }
            if (lines[i].includes('data: http') || lines[i].includes('data: /')) {
                const match = lines[i].match(/data:\s*(\S+)/);
                if (match && match[1].includes('message')) {
                    endpoint = match[1];
                    break;
                }
            }
        }

        if (endpoint) {
            try {
                const postUrl = endpoint.startsWith('http') ? new URL(endpoint) : new URL(endpoint, baseUrl);
                
                const req = http.request(postUrl, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                }, (postRes) => {
                    let body = '';
                    postRes.on('data', d => body += d);
                    postRes.on('end', () => {
                        try {
                            const json = JSON.parse(body);
                            if (json.result && json.result.tools) {
                                console.log(`SUCCESS: Found ${json.result.tools.length} tools`);
                                console.log("TOOLS LIST:");
                                json.result.tools.forEach(t => console.log(`- ${t.name}`));
                            } else {
                                console.log("Response:", body);
                            }
                        } catch (e) {
                            console.log("Parse error:", e);
                            console.log("Raw response:", body);
                        }
                        process.exit(0);
                    });
                });
                
                req.on('error', e => {
                    console.log("POST error:", e);
                    process.exit(1);
                });

                req.write(JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/list"
                }));
                req.end();
            } catch(e) {
                console.log("Error constructing URL:", e);
                process.exit(1);
            }
        }
    });
}).on('error', (e) => {
    console.error("GET error:", e.message);
});
