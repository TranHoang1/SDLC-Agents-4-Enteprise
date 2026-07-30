---
name: 'File Writing Standards'
description: 'Large file chunking + DOCX export rules'
applyTo: 'documents/**'
---

# File Writing Standards

## Large document chunking (MANDATORY)

Use `stream_write_file` (MCP tool). Chunks ≤ 4000 chars:
- First chunk: `mode="write"`
- Subsequent chunks: `mode="append"`

Fallback: if `stream_write_file` fails → `fsWrite` + `fsAppend`. Don't retry same error.

## Verify after each write

Check `bytes_written == total_size - file_size_before`. If wrong → reduce chunk size, retry.

## DOCX Export

1. Search KB first: `kb_search("export markdown docx")`
2. If no KB pattern → `find_tools("export docx")`, test, ingest result
3. ALWAYS embed images before export
4. NO CLI tools (pandoc) — use MCP tools
5. Filename: `{DOC}-v{MAJOR}-{TICKET}.docx`
6. Graceful degradation: tool unavailable → log WARNING, skip