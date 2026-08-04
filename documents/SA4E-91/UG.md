# User Guide — SA4E-91: KB Graph Edge Extraction on Ingest/Index

## Overview

SA4E-91 fixes the bug where KB Graph nodes were created without relationships. Previously, only the Pega indexer created edges; the `code_intel_upload` and `mem_ingest` paths created orphan nodes. This fix adds an **Edge Extraction middleware layer** that auto-creates edges on all write paths.

## How It Works

### Code Intelligence Path (`code_intel_upload`)

When code is indexed, the `GraphSyncService` now calls `extractAndInsertCodeEdges()` after projecting code symbols into `graph_nodes`. Three edge types are extracted:

| Edge Type | Source Table | Meaning |
|-----------|-------------|---------|
| IMPORTS | `code_dependencies` | File A imports File B |
| CALLS | `code_call_graph` | Symbol X calls Symbol Y |
| EXTENDS | `symbols.parent_symbol_id` | Class Child extends Class Parent |

### Knowledge Entry Path (`mem_ingest`)

When a KB entry is ingested, `extractAndInsertIngestEdges()` runs after the graph node is created. It pattern-matches the entry content against existing graph nodes:

| Edge Type | Pattern | Example |
|-----------|---------|---------|
| DISCUSSES | Ticket key (e.g. `SA4E-50`) | Entry mentions a ticket that has a graph node |
| REFERENCES | File path (e.g. `crud.ts`) | Entry mentions a file that has a graph node |
| REFERENCES | PascalCase class name (e.g. `GraphService`) | Entry mentions a class/type |
| BELONGS_TO | `source` field matches a node label | Entry originates from a specific file |

## Configuration

No configuration is required. Edge extraction is enabled by default and operates transparently.

### Behavior Characteristics

- **Non-blocking**: Edge extraction never slows down or fails the primary operation (index/ingest)
- **Best-effort**: If edge extraction encounters an error, it is silently logged and skipped
- **Idempotent**: Uses `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING` — safe to re-run
- **Bounded**: Matches against at most 2000 existing graph nodes per ingest

## Troubleshooting

### No edges appearing after index

**Check**: Verify `code_dependencies` and `code_call_graph` tables have data:
```sql
SELECT COUNT(*) FROM code_dependencies;
SELECT COUNT(*) FROM code_call_graph;
```
If empty, the code parser may not be extracting imports/calls for your language.

### No edges appearing after mem_ingest

**Check**: Verify `graph_nodes` has existing entries for matching:
```sql
SELECT COUNT(*) FROM graph_nodes;
```
Edge-on-ingest needs existing nodes to match against. If the graph is empty, edges cannot be created.

### Edges not visible in KB Graph UI

The KB Graph visualization reads from `graph_edges` table. Verify edges exist:
```sql
SELECT source, target, rel_type FROM graph_edges LIMIT 20;
```

## Edge Types Reference

| Edge Label | Weight | Created By | Meaning |
|-----------|--------|-----------|---------|
| IMPORTS | 0.8 | code_intel_upload | File-level import dependency |
| CALLS | 0.7 | code_intel_upload | Function/method call relationship |
| EXTENDS | 0.9 | code_intel_upload | Class inheritance |
| DISCUSSES | 0.5 | mem_ingest | Entry references a ticket |
| REFERENCES | 0.6 | mem_ingest | Entry references a file or class |
| BELONGS_TO | 0.6 | mem_ingest | Entry originates from a source file |

## Architecture

The implementation follows the **Strategy pattern** (consistent with existing `edge-extractors.ts` for Pega rules):

- `CodeEdgeStrategy` interface — each strategy extracts one edge type from code-intel tables
- `IngestEdgeStrategy` interface — each strategy pattern-matches one reference type from content
- Both registries are iterated by their respective orchestrator functions
- All strategies are fail-isolated: one strategy failure doesn't affect others
