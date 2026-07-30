# Code Intelligence System

## Quick Reference

- **Scripts**: `.analysis/code-intelligence/scripts/src/`
- **Config**: `.analysis/code-intelligence/index-config.json`
- **Metadata**: `.analysis/code-intelligence/index-metadata.json`
- **Analysis files**: `.analysis/code-intelligence/project-structure.md`, `modules/*.md`

## Code Indexing (Auto)

MCP server auto-indexes on startup. Check status: `code_index_status`. Manual re-index: `code_index_status { "reindex": true }`.

Sync code symbols to Memory: `mem_sync_code {}` or `mem_sync_code { "kind": "class", "limit": 500 }`.

## Document Indexing (Manual)

| Document | Type |
|---|---|
| BRD/FSD | `REQUIREMENT` |
| TDD | `ARCHITECTURE` |
| STP/STC | `PROCEDURE` |
| DPG/RLN | `PROCEDURE` |
| Lessons learned | `LESSON_LEARNED` |

Index: `mem_ingest_file { "file_path": "...", "type": "REQUIREMENT", "format": "markdown" }`

## Hybrid Indexing Strategy

- **TypeScript script** generates: `index-metadata.json`, `kb-payloads.json`, `modules/*.md`
- **Agent writes manually**: `project-structure.md` (script language detection is inaccurate for Kotlin)

Run: `cd .analysis/code-intelligence/scripts && npx tsx src/full-indexer.ts ../../../`

## Best Practices

- Re-index code after adding/deleting many files
- Index documents immediately after creating/updating BRD, FSD, TDD
- Run `mem_consolidate` periodically