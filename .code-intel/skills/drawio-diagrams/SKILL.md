---
name: drawio-diagrams
description: Create draw.io XML diagrams and export to PNG for SDLC documents
---

## Draw.io Diagram Requirements

- **NEVER use Mermaid** — use draw.io for ALL diagrams
- All diagrams stored at `documents/{TICKET}/diagrams/`
- Each diagram: `.drawio` (source) + `.png` (rendered)

## XML Format Rules
- Use bare `<mxGraphModel>` only — NO `<mxfile>` wrapper
- Structure: `<mxGraphModel adaptiveColors="auto"><root><mxCell id="0"/><mxCell id="1" parent="0"/>...</root></mxGraphModel>`
- Every edge MUST use expanded form with `<mxGeometry relative="1" as="geometry"/>` child
- NEVER use self-closing edge cells — arrows will be invisible
- Always include `html=1` in every cell style
- NEVER include XML comments

## Minimum Diagrams per Document
| Document | Required Diagrams |
|----------|-----------------|
| BRD | business-flow + use-case |
| FSD | system-context + sequence + state |
| TDD | architecture + component + class |
| STP | test-coverage + test-execution-flow |
| DPG | deployment-flow + rollback-flow |

## Export Procedure
```powershell
& "C:\Program Files\draw.io\draw.io.exe" -x -f png -b 10 -o "documents/{TICKET}/diagrams/{name}.png" "documents/{TICKET}/diagrams/{name}.drawio"
```
- Export EVERY `.drawio` file
- Wait 5s between exports
- Verify all PNGs exist after export

## Embedding
Every `.drawio` file MUST have:
1. `![{name}](diagrams/{name}.png)` in corresponding document
2. `*[Edit in draw.io](diagrams/{name}.drawio)*` below the PNG
3. Ingest full XML into KB with tags: drawio, diagram, {type}, {TICKET}
