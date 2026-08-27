# Hướng dẫn sử dụng code-intel MCP — Dynamic Tools

MCP server `code-intel` (cấu hình trong `opencode.json` → `mcp.code-intel`) cung cấp các **dynamic tools** — tức là các công cụ được phát hiện và đăng ký lúc runtime, KHÔNG nằm cố định trong system prompt. Do đó, để dùng chúng bạn PHẢI chủ động khám phá tên tool trước khi gọi.

## 1. Tìm kiếm tool — `code-intel_find_tools`

Tìm kiếm theo ngữ nghĩa (semantic) các tool có sẵn phù hợp với ý định:

```
code-intel_find_tools(query: "semantic code search across symbols")
code-intel_find_tools(query: "export drawio diagram to png")
code-intel_find_tools(query: "ingest knowledge into memory")
code-intel_find_tools(query: "curated context for a question")
```

Kết quả trả về danh sách `toolName` + mô tả. Chọn tool gần nhất với nhu cầu.

## 2. Thực thi tool — `code-intel_execute_dynamic_tool`

Sau khi biết `toolName`, gọi để thực thi:

```
code-intel_execute_dynamic_tool(
  toolName: "code_intel_drawio_export_png",
  arguments: { "file_path": "docs/flow.drawio", "output_path": "docs/flow.png" }
)
```

- `toolName`: tên chính xác lấy từ `find_tools` (thường có prefix `code_intel_`).
- `arguments`: object JSON chứa tham số của tool đó (xem mô tả trả về ở bước 1).

## Quy trình chuẩn (workflow)

1. Nhận nhu cầu chuyên biệt (vẽ diagram, semantic search, memory ingest/search, doc export...) mà tool tĩnh (`bash`, `read`, `grep`, `glob`, `edit`, `write`) không đáp ứng.
2. Gọi `code-intel_find_tools(query)` để khám phá tên tool chính xác.
3. Gọi `code-intel_execute_dynamic_tool(toolName, arguments)` để chạy.
4. Nếu sai tên / thiếu tham số → đọc thông báo lỗi, gọi lại `find_tools` để xác nhận rồi thử lại.

## Các tool phổ biến của code-intel (tham khảo)

| Tool | Dùng cho |
|------|----------|
| `code_intel_code_search` | Tìm kiếm full-text trên symbols |
| `code_intel_get_curated_context` | Truy vấn ngữ nghĩa toàn bộ codebase (code + memory + graph) |
| `code_intel_mem_search` | Tìm kiếm trong workspace memory (BM25 + vector) |
| `code_intel_mem_ingest` / `code_intel_mem_ingest_file` | Lưu knowledge vào memory |
| `code_intel_drawio_auto_layout` | Tự động sắp xếp layout drawio |
| `code_intel_drawio_export_png` | Export drawio sang PNG |
| `code_intel_embed_image` | Nhúng ảnh base64 vào markdown |
| `code_intel_execute_dynamic_tool` | Thực thi bất kỳ dynamic tool nào đã phát hiện |
| `code_intel_find_tools` | Khám phá danh sách dynamic tool |

## Lưu ý quan trọng

- ⛔ LUÔN gọi `find_tools` trước khi đoán tên tool — đừng tự bịa tên.
- ⛔ Nếu MCP `code-intel` không kết nối (lỗi connection) → báo lỗi rõ ràng cho user, KHÔNG giả lập kết quả.
- ✅ Khi đã biết tên tool, ưu tiên `execute_dynamic_tool` thay vì gọi tool tĩnh tương đương (vd: vẽ diagram qua drawio tool thay vì tự viết XML).
