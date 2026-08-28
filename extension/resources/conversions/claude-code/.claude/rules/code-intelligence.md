---
paths:
  - ".analysis/**"
  - "backend/src/**/*.ts"
---

# Code Intelligence System

## Quick Reference

- **Scripts**: `.analysis/code-intelligence/scripts/src/`
- **Config**: `.analysis/code-intelligence/index-config.json`
- **Metadata**: `.analysis/code-intelligence/index-metadata.json`
- **Analysis files**: `.analysis/code-intelligence/project-structure.md`, `modules/*.md`

## 1. Code Indexing (Auto)

MCP server auto-indexes on startup. Check status:
```
Tool: code_index_status
```

### Manual re-index:
```
Tool: code_index_status
Arguments: { "reindex": true }
```

### Sync code symbols to Memory:
```
Tool: mem_sync_code
Arguments: {} (sync all classes + interfaces)
```

## 2. Document Indexing (Manual)

| Document | Type |
|---|---|
| BRD | `REQUIREMENT` |
| FSD | `REQUIREMENT` |
| TDD | `ARCHITECTURE` |
| STP/STC | `PROCEDURE` |
| DPG/RLN | `PROCEDURE` |
| Lessons learned | `LESSON_LEARNED` |

### Index a document:
```
Tool: mem_ingest_file
Arguments: { "file_path": "documents/{TICKET}/{DOC}.md", "type": "REQUIREMENT", "format": "markdown" }
```

## 3. Search Knowledge Base

```
Tool: mem_search
Arguments: { "query": "authentication flow", "detail": true }
```

Filter by role:
```
Tool: mem_search
Arguments: { "query": "API design", "role": "SA" }
```

## 4. Indexing Strategy: Hybrid (Script + Agent)

The indexing uses a **hybrid approach**:
- **TypeScript script** generates: `index-metadata.json`, `kb-payloads.json`, `modules/*.md`
- **Agent writes manually**: `project-structure.md` (script language detection can be inaccurate, verify manually)

### Run indexer:
```
cd .analysis/code-intelligence/scripts && npx tsx src/full-indexer.ts ../../../
```

### Manual fallback (if script fails):
- Read project structure using file tools
- Write `index-metadata.json` + `project-structure.md` + `kb-payloads.json`

## 5. Best Practices

- **Re-index code**: After adding/deleting many files, or after large merge
- **Index documents**: Immediately after creating/updating BRD, FSD, TDD
- **Sync code**: After re-index, or when agents need code↔doc cross-references
- **Consolidate memory**: Run `mem_consolidate` periodically

## 6. Logging Format

```
[Code-Index] ERROR: {error-type} — {file-path} — {error-message}
[Code-Index] WARN: {warning-type} — {context} — {message}
[Code-Index] INFO: {action} — {details}
```