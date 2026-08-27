# SDLC Guardrails (agent-enforced)

Các kiểm tra sau được AGENT (LLM) thực hiện — không qua code cứng — nên dễ chỉnh sửa và portable trên mọi máy. Agent áp dụng chúng theo ngữ cảnh, không bắt buộc máy móc.

## 1. Drawio XML validation
Trước khi export hoặc commit một file `.drawio`, tự kiểm tra XML hợp lệ:
- Phải có thẻ gốc `<mxGraphModel>` và `</mxGraphModel>` tương ứng.
- Mọi thẻ phải cân bằng (mỗi `<tag>` có `</tag>`, hoặc tự đóng `<tag/>`).
- Nếu không hợp lệ → sửa trước khi export; không commit drawio lỗi.

## 2. Code-index freshness
Trước các phase SA (Design) và DEV (Implementation), đảm bảo code-intel index đang mới. Nếu codebase thay đổi nhiều, chạy lại indexer. Dùng code-intel dynamic tools (`find_tools` → `execute_dynamic_tool`) để query/refresh.

## 3. KB-first
Trước khi viết hoặc cập nhật bất kỳ document nào (BRD/FSD/TDD/STP/STC/UG/DPG/RLN), tìm kiếm knowledge base trước (`mem_search`) để tái dùng context và tránh trùng lặp.

## 4. Version-sync check
Khi bump version / tạo git tag, đảm bảo tag, package version, và README changelog nhất quán. Không tag nếu mismatch.

## 5. Memory sync
Sau khi sửa source code, ingest/cập nhật memory liên quan (`mem_ingest` / `mem_ingest_file`) để các agent khác cùng hưởng lợi.
