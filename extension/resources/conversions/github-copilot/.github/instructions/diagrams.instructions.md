---
applyTo: "documents/**,**/*.drawio"
---

# Draw.io Diagram Requirements

## Core Rules

- **NEVER use Mermaid** — use draw.io for ALL diagrams
- All diagrams stored at `documents/{TICKET}/diagrams/`
- Each diagram: `.drawio` (source) + `.png` (rendered)

---

## XML File Structure

```xml
<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <!-- nodes and edges here -->
  </root>
</mxGraphModel>
```

### Rules

1. **No `<mxfile>` wrapper** — file MUST start with `<mxGraphModel>`
2. **IDs `0` and `1` are RESERVED** — never reuse them for custom cells
3. **Every edge MUST have `<mxGeometry>` child** — self-closing edge cells (`/>`) do NOT render
4. Always include `html=1` in every cell style
5. NEVER include XML comments
6. MUST include `pageWidth`, `pageHeight`, `grid`, `gridSize` attributes

### Edge Cell Format (MANDATORY)

```xml
<!-- CORRECT — edge with geometry child -->
<mxCell id="e1" value="label" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=classic;endFill=1;fontSize=10;" edge="1" parent="1" source="n1" target="n2">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>

<!-- WRONG — self-closing edge (will NOT render) -->
<mxCell id="e1" value="label" style="..." edge="1" parent="1" source="n1" target="n2"/>
```

### Node Cell Format

```xml
<mxCell id="n1" value="Node Label" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="140" height="50" as="geometry"/>
</mxCell>
```

---

## 7-Color Semantic Palette (MANDATORY)

Every node MUST use a semantic color based on its role:

| Role | Fill | Stroke | Use For |
|------|------|--------|---------|
| Primary | `#dae8fc` | `#6c8ebf` | Main components, core modules |
| New/Created | `#d5e8d4` | `#82b366` | New modules, added elements |
| Warning/External | `#fff2cc` | `#d6b656` | Validation, external dependencies |
| Actor/User | `#e1f5fe` | `#0288d1` | Users, external systems, actors |
| Unchanged | `#f5f5f5` | `#666666` | Legacy/unchanged components |
| Error | `#f8cecc` | `#b85450` | Error paths, failure states |
| Data/Parser | `#f3e5f5` | `#9673a6` | Data processing, parsers |

**Rules:**
- NEVER use default white/no-color nodes
- Choose color by semantic role, not aesthetics
- Be consistent within same diagram (same role = same color)

---

## Edge Routing (MANDATORY)

### All edges MUST use orthogonal routing:

```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=classic;endFill=1;fontSize=10;"
```

### Edge types:

| Type | Style |
|------|-------|
| Normal flow | `endArrow=classic;endFill=1` |
| Return/async | `endArrow=open;endFill=0;dashed=1` |
| Error path | `strokeColor=#b85450;endArrow=classic;endFill=1` |
| Dependency | `endArrow=open;endFill=0;dashed=1;strokeColor=#666666` |
| Inheritance | `endArrow=block;endFill=0;endSize=12` (hollow triangle) |
| Bidirectional | `startArrow=classic;startSize=6;endArrow=classic;endSize=6` |

### Edge labels (MANDATORY for meaningful relationships):

All edges connecting meaningful components must have a `value="label"` describing the relationship.

### Waypoints for backward/cross edges:

```xml
<mxCell id="e5" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=classic;" edge="1" parent="1" source="nodeA" target="nodeB">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="600" y="150"/>
      <mxPoint x="300" y="150"/>
    </Array>
  </mxGeometry>
</mxCell>
```

### Port Distribution (prevent stacked edges from same node):

| exitX/entryX | Position |
|--------------|----------|
| 0 | Left |
| 0.25 | Quarter left |
| 0.5 | Center |
| 0.75 | Quarter right |
| 1 | Right |

---

## Layout Rules

- **Grid snap**: 10px — all coordinates MUST be multiples of 10
- **Minimum node spacing**: 40px horizontal, 60px vertical between rows
- **Row gap** (routing corridors): 80-100px between rows for backward edges
- **Layout Strategy**: Plan layers/tiers BEFORE placing. Group nodes by depth, place sequentially.

---

## Container/Swimlane Rules

1. Children `parent` = container id (NOT "1")
2. Coordinates RELATIVE to container top-left
3. Container large enough: add 20px padding around children
4. Internal edges: `parent="{containerId}"`
5. Cross-boundary edges: `parent="1"`

---

## UML Sequence Diagram Format (CRITICAL)

**NEVER use `shape=umlLifeline`** — drawio-cli renderer does NOT support UML-specific shapes, export produces 0-byte PNG.

### Use: participant boxes + dashed vertical lifelines + horizontal positional arrows:

- Participant: rounded box with `fillColor=#e1f5fe;strokeColor=#0288d1;fontSize=11;fontStyle=1`
- Lifeline: dashed vertical edge with `endArrow=none;dashed=1;strokeColor=#999999`
- Messages: horizontal edges using `sourcePoint`/`targetPoint` (NOT source/target cell IDs)
- Sync call: `endArrow=block;endFill=1`
- Return: `endArrow=open;endFill=0;dashed=1`
- Participant spacing: 200-250px apart
- Message Y increment: 40-50px per message

### FORBIDDEN:
- `shape=umlLifeline`
- `source="p1" target="p2"` on message edges

---

## Minimum Diagrams per Document

| Document | Required Diagrams |
|----------|-----------------|
| BRD | business-flow + use-case |
| FSD | system-context + sequence + state |
| TDD | architecture + component + class |
| STP | test-coverage + test-execution-flow |
| DPG | deployment-flow + rollback-flow |

---

## Export Procedure

```powershell
& "C:\Program Files\draw.io\draw.io.exe" -x -f png -b 10 --width 2000 --no-sandbox -o "documents/{TICKET}/diagrams/{name}.png" "documents/{TICKET}/diagrams/{name}.drawio"
```

- Include `--width 2000` for high-resolution output
- Export EVERY `.drawio` file, wait 5s between exports
- Verify all PNGs exist and size > 1KB

---

## Self-Check (MANDATORY Before Export)

| # | Check | Fix |
|---|-------|-----|
| 1 | No self-closing edge cells | Add `<mxGeometry relative="1" as="geometry"/>` |
| 2 | Starts with `<mxGraphModel>` | Remove `<mxfile>` wrapper |
| 3 | Coordinates multiples of 10 | Round to grid |
| 4 | No node overlaps | Shift apart >= 40px |
| 5 | Container fits children | Increase width/height |
| 6 | Edge source/target IDs exist | Fix dangling edges |
| 7 | Backward edges have waypoints | Add `<Array as="points">` |
| 8 | No stacked edges from same node | Distribute ports (exitX/exitY) |
| 9 | All nodes have semantic fillColor | Apply 7-color palette |
| 10 | All meaningful edges have labels | Add value="..." |
| 11 | All edges use orthogonalEdgeStyle | Fix edge style |
| 12 | Container children have correct parent | Set parent=containerId |

---

## Vision Self-Check (MANDATORY for quality)

After PNG export:
1. Read the exported PNG image
2. Check for: overlapping shapes, clipped labels, missing connections, stacked edges
3. If issues found → fix XML → re-export → re-check (max 2 rounds)
4. Minimum quality: no major overlaps, all connections visible, labels readable

---

## Diagram Index (MANDATORY in every document with diagrams)

```markdown
### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | {Name} | [{name}.png](diagrams/{name}.png) | [{name}.drawio](diagrams/{name}.drawio) |
```

---

## KB Ingestion

All `.drawio` files MUST be ingested into KB:
- Ingest FULL XML content
- Tags: `drawio, diagram, {diagram-type}, {TICKET}`

---

## Auto-Layout Tool Warning

**Known limitation:** ELK flattens swimlane hierarchy — do NOT use on container/swimlane diagrams.
