---
name: file-writing
description: File writing standards — stream_write_file for large documents, DOCX export
---

## Stream Writing for Large Files
- For files > 50 lines: use `stream_write_file` tool
- First call: `mode="write"` to create the file
- Subsequent calls: `mode="append"` for each section
- Chunk size: ≤ 4000 characters per append call
- NEVER use `fsWrite`/`fsAppend` for documents > 50 lines

## Fallback
- If `stream_write_file` is unavailable, use `fsWrite` + `fsAppend`
- Log a warning when falling back

## DOCX Export Process
1. **Embed images first:** `embed_images(file_path="...", output_path="...-embedded.md")`
   - Creates self-contained markdown with base64 images
   - ALWAYS use file_path, NEVER pass content as parameter
2. **Export to DOCX:** `export_docx(file_path="...-embedded.md", file_name="{DOC}-v{ver}-{TICKET}")`
3. **Copy to project:** `Copy-Item -Path "<returned>" -Destination "documents/{TICKET}/{DOC}-v{ver}-{TICKET}.docx"`
4. **Cleanup:** Delete the temp `-embedded.md` file

## Naming Convention
- `{DOC}-v{MAJOR}-{TICKET}.docx`
- Example: `BRD-v1-CRP-84.docx`, `FSD-v2-CRP-84.docx`
