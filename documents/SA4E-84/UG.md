# User Guide — SA4E-84: drawio_auto_layout (ELK Fix Mode)

## Overview

The `drawio_auto_layout` MCP tool analyzes draw.io diagram layout and **automatically fixes** issues (overlapping nodes, edge crossings, diagonal edges) using the ELK.js layout engine. It reads the `.drawio` file directly, applies optimal node positioning, and writes the fixed XML back to the file.

---

## Quick Start

Call the tool with a file path:

```json
{
  "tool": "drawio_auto_layout",
  "arguments": {
    "file_path": "documents/SA4E-84/diagrams/architecture.drawio"
  }
}
```

The tool will:
1. Read the file
2. Detect layout issues
3. If issues found → run ELK layout → write fixed XML to file
4. Return metadata (status, repositioned nodes)

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file_path` | string | **Yes** | — | Path to `.drawio` file (relative to workspace or absolute) |
| `algorithm` | string | No | `layered` | Layout algorithm: `layered`, `force`, `mrtree`, `radial` |
| `spacing` | number | No | `80` | Node spacing in pixels |
| `direction` | string | No | `DOWN` | Layout direction: `DOWN`, `RIGHT`, `LEFT`, `UP` |

---

## Output

### When no issues found

```json
{ "status": "already_good", "message": "Diagram looks good — no overlapping nodes or edge crossings detected." }
```

The file is **not modified**.

### When issues fixed

```json
{ "status": "fixed", "message": "Fixed 3 issues with ELK layered layout. 4 nodes repositioned." }
```

The file is **overwritten** with fixed XML.

### On error

```json
{ "error": "File not found or not accessible" }
```

---

## Issue Types Detected

| Type | Severity | Description |
|------|----------|-------------|
| `node_overlap` | high | Two nodes occupy >50% of the same area |
| `edge_crossing` | medium | An edge line passes through a node it's not connected to |
| `diagonal_edge` | low | Edge is neither horizontal nor vertical (>20px deviation) |

---

## Algorithm Guide

| Algorithm | Best For | When to Use | ELK Mapping |
|-----------|----------|-------------|-------------|
| `layered` | Flow diagrams, sequences | Hierarchical with clear direction. **Default.** | `org.eclipse.elk.layered` |
| `force` | Network/organic diagrams | Non-hierarchical, many-to-many connections | `org.eclipse.elk.force` |
| `mrtree` | Tree structures | Parent→children (org charts, file trees) | `org.eclipse.elk.mrtree` |
| `radial` | Star/hub topologies | One central node connected to many | `org.eclipse.elk.radial` |

---

## Configuration

Environment variables for performance limits:

| Variable | Default | Description |
|----------|---------|-------------|
| `SA4E_ELK_MAX_NODES` | `500` | Maximum nodes allowed (returns error if exceeded) |
| `SA4E_ELK_TIMEOUT_MS` | `10000` | ELK layout timeout in milliseconds |

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `file_path is required` | Missing file_path parameter | Provide the path to a `.drawio` file |
| `File not found: ...` | File doesn't exist at the given path | Check the file path (relative to workspace) |
| `No nodes found in diagram` | File parses but contains no drawable nodes | Ensure the file has valid `<mxCell>` elements with geometry |
| `Diagram too large (N nodes, max 500)` | Exceeds node limit | Set `SA4E_ELK_MAX_NODES` env var higher, or split diagram |
| `ELK layout timed out after 10000ms` | Complex diagram takes too long | Increase `SA4E_ELK_TIMEOUT_MS` or simplify diagram |
| `ELK layout produced no position changes` | ELK couldn't improve positions | Try a different algorithm |

---

## Workflow Integration

After `drawio_auto_layout` fixes a file, export PNG:

```json
{
  "tool": "drawio_export_png",
  "arguments": {
    "file_path": "documents/SA4E-84/diagrams/architecture.drawio"
  }
}
```

Typical agent workflow:
1. Create/edit `.drawio` file
2. Call `drawio_auto_layout` with `file_path` → fixes layout
3. Call `drawio_export_png` with same `file_path` → generates PNG
