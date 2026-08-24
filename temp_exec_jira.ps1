$url='http://localhost:48721/mcp'
$body='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"execute_dynamic_tool","arguments":{"tool_name":"jira_get_issue","arguments":{"issue_key":"SA4E-188","fields":"*all","expand":"renderedFields,changelog"}}}}'
$headers=@{'Content-Type'='application/json';'Accept'='application/json, text/event-stream'}
$resp=Invoke-WebRequest -Uri $url -Method Post -Body $body -Headers $headers -UseBasicParsing
Write-Output $resp.Content