---
paths:
  - "documents/**"
  - "**/*.drawio"
---

# Draw.io Diagram Requirements (Full)

## ⛔ CRITICAL: Edge Routing Rules

**MANDATORY on FIRST attempt:**
1. NEVER `edgeStyle=orthogonalEdgeStyle` when edge crosses other nodes
2. ALWAYS explicit waypoints for fan-out (1→3+) and fan-in (3+→1)
3. Fan-out: left/right branches get waypoints, center = no waypoints
4. ONLY use orthogonalEdgeStyle for: self-loops, simple 1:1 adjacent edges, short swimlane connections

## Workflow

1. **Plan** — diagram type, shapes, relationships, layout direction
2. **Generate XML** → write `.drawio` file
3. **Validate** — no self-closing edges, no dangling edges, no duplicate IDs
4. **Auto-layout** — call `drawio_auto_layout(file_path="<path>")`
5. **Export PNG** — Preferred: MCP tool `drawio_export_png`; Fallback: CLI `draw.io.exe -x -f png`
6. **Vision Self-Check** (MANDATORY) — read PNG, check overlaps/clipped labels/missing connections
7. **Done**

## XML Structure

```xml
<mxGraphModel adaptiveColors="auto">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>
```

- `id="0"` = root, `id="1"` = default parent (both mandatory)
- Bare `<mxGraphModel>` for ALL diagrams EXCEPT Use Case (uses `<mxfile><diagram>` wrapper)
- **CRITICAL:** Every edge MUST have `<mxGeometry relative="1" as="geometry"/>` child — self-closing = invisible arrows

## Minimum Diagrams Per Document

| Document | Required |
|----------|----------|
| BRD | business-flow.drawio + use-case.drawio |
| FSD | system-context.drawio + sequence-*.drawio + state-*.drawio |
| TDD | architecture.drawio + component.drawio + class-*.drawio |
| STP | test-coverage.drawio + test-execution-flow.drawio |
| DPG | deployment-flow.drawio + rollback-flow.drawio |

## Color Palette

| Category | fill | stroke |
|---|---|---|
| Primary/Info | #e1f5fe / #dae8fc | #0288d1 / #6c8ebf |
| Success/Service | #e8f5e9 / #d5e8d4 | #388e3c / #82b366 |
| Warning | #fff3e0 / #fff2cc | #f57c00 / #d6b656 |
| Error | #fce4ec | #c62828 |
| Purple (UI/Data) | #f3e5f5 / #e1d5e7 | #7b1fa2 / #9673a6 |

## Shape Styles

| Shape | Style |
|---|---|
| Rounded rect | `rounded=1;whiteSpace=wrap;html=1;` |
| Diamond | `rhombus;whiteSpace=wrap;html=1;` |
| Ellipse | `ellipse;whiteSpace=wrap;html=1;` |
| Cylinder (DB) | `shape=cylinder3;whiteSpace=wrap;html=1;` |
| Actor | `shape=actor;whiteSpace=wrap;html=1;` |
| Lifeline | `shape=umlLifeline;perimeter=lifelinePerimeter;size=16;` |

## Edge Styles

| Type | Syntax |
|---|---|
| Orthogonal | `edgeStyle=orthogonalEdgeStyle` |
| Straight | (no edgeStyle) |
| Entity Relation | `edgeStyle=entityRelationEdgeStyle` |
| Curved | `curved=1` |

Standard: `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;endSize=6;`

## Edge Semantics

| Style | Meaning |
|---|---|
| Solid + classic arrow | Creation, invocation, data flow |
| Dashed + classic arrow | Dependency, event, callback |
| Solid + block hollow arrow | Inheritance (extends) |
| Bidirectional (start+end arrows) | Two-way communication |

## Use Case Diagrams

- MUST use `<mxfile><diagram>` wrapper, page 1169×827 (A3 landscape)
- Actor: `shape=actor;whiteSpace=wrap;html=1;`
- NO edgeStyle for Actor→UC edges, WITH waypoints through corridors
- `<<include>>`/`<<extend>>`: `dashed=1;endArrow=open;`

## HTML Labels

- Always `html=1` in style
- Newline: `&#10;` (universal). NEVER `\n`
- fontStyle: 1=bold, 2=italic, 4=underline
- Partial formatting: `<b>Title</b><br>desc`

## Containers

| Type | Style |
|---|---|
| Group (invisible) | `group;` |
| Swimlane (titled) | `swimlane;startSize=30;` |
| Custom container | `container=1;pointerEvents=0;` on any shape |

## Grid Placement

| Type | Col X | Row Y | Node Sizes |
|---|---|---|---|
| Default | col*220+60 | row*160+60 | rect 160×70 |
| Class | col*300+40 | row*160+60 | wider boxes |
| State | col*250+60 | row*160+60 | medium |

Min gap: 80px between nodes.

## Post-Export Validation (MANDATORY)

1. Every edge has `<mxGeometry>` child
2. No dangling edges (source/target IDs exist as vertices)
3. No duplicate IDs
4. Root cells `id="0"` and `id="1"` present
5. PNG file > 1KB
6. Title cell exists (fontSize=14)
7. **Vision Self-Check** — score ⭐⭐⭐⭐+ (no overlaps, clear labels)

## Diagram Index (MANDATORY in every document appendix)

```markdown
### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | {Name} | [{name}.png](diagrams/{name}.png) | [{name}.drawio](diagrams/{name}.drawio) |
```

## Quality Rubric

| Score | Criteria |
|---|---|
| ⭐⭐⭐⭐⭐ | No overlaps, clear labels, consistent colors, proper spacing |
| ⭐⭐⭐⭐ | Minor spacing issues, all connections correct |
| ⭐⭐⭐ | Readable but 1-2 overlaps or clipped labels |
| ⭐⭐ | Multiple overlaps, hard to follow |
| ⭐ | Unusable |

**Minimum: ⭐⭐⭐⭐** — SM should request re-generation if below this.