# File Writing Standards

## 1. Large document chunking (MANDATORY)

Use `stream_write_file` (MCP tool). Chunks ≤ 4000 chars:
- First chunk: `mode="write"`
- Subsequent chunks: `mode="append"`

Fallback: If `stream_write_file` fails → use `fsWrite` + `fsAppend`. Don't retry same error.

## 2. Verify after each write

Check response: `bytes_written == total_size - file_size_before`. If wrong → reduce chunk size, retry.

## 3. DOCX Export

1. Search KB first: `kb_search("export markdown docx")`
2. If no KB pattern → `find_tools("export docx")`, test, ingest result
3. ALWAYS embed images before export (export tool has no filesystem access)
4. NO CLI tools (pandoc, etc.) — use MCP tools
5. Filename: `{DOC}-v{MAJOR}-{TICKET}.docx`
6. Graceful degradation: tool unavailable → log WARNING, skip