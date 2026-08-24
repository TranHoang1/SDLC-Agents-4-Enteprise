$url='http://localhost:48721/mcp'
$body='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_tools","arguments":{"query":"jira get issue","threshold":0.4,"top_k":5}}}'
$headers=@{'Content-Type'='application/json';'Accept'='application/json, text/event-stream'}
$resp=Invoke-WebRequest -Uri $url -Method Post -Body $body -Headers $headers -UseBasicParsing
Write-Output $resp.Content