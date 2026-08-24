# Software Test Cases (STC)

## SA4E-192 — Slash Commands (Tier 2)

| Ticket | SA4E-192 | Version | 1.0 |
|--------|----------|---------|-----|

| TC | Command | Precondition | Steps | Expected | AC Link |
|----|---------|--------------|-------|----------|---------|
| TC-01 | /copy | Chat has >=1 message | run /copy | Clipboard contains markdown; confirmation shown | AC /copy |
| TC-02 | /debug | Session ran tools | run /debug | Panel shows tokens, tool calls, duration | AC /debug |
| TC-03 | /help | Commands registered | run /help | Lists 8 commands w/ desc | AC /help |
| TC-04 | /init | No .code-intel | run /init | .code-intel/ created w/ examples | AC /init |
| TC-05 | /sessions | >1 session | run /sessions | Lists; switch works | AC /sessions |
| TC-06 | /skills | skills exist | run /skills | Lists; invoke works | AC /skills |
| TC-07 | /status | Runtime up | run /status | Shows conn, tool/hook/agent counts | AC /status |
| TC-08 | /thinking | Session active | run /thinking | Toggles display flag | AC /thinking |
| TC-09 | security | any command | pass args `$(rm -rf /)` | Args treated as data, no exec | Sec design |
| TC-10 | unknown | - | run /foo | "Unknown command, try /help" | Error handling |
